from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import random
import string
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timezone


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------- Models ----------
class PlayerCreate(BaseModel):
    name: str


class Player(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    created_at: str = Field(default_factory=now_iso)


class ScoreCreate(BaseModel):
    player_id: str
    name: str
    score: int
    mode: str = "solo"
    strikes: int = 0
    spares: int = 0
    result: Optional[str] = None  # win / lose / None


class RoomCreate(BaseModel):
    player_id: str
    name: str


class RoomJoin(BaseModel):
    player_id: str
    name: str


class RoomProgress(BaseModel):
    player_id: str
    name: str
    score: int
    current_frame: int
    finished: bool = False


# ---------- Helpers ----------
def clean(doc: dict) -> dict:
    doc.pop("_id", None)
    return doc


def gen_code() -> str:
    return "".join(random.choices(string.ascii_uppercase + string.digits, k=4))


# ---------- Routes ----------
@api_router.get("/")
async def root():
    return {"message": "Super Strike API"}


@api_router.post("/players", response_model=Player)
async def create_player(input: PlayerCreate):
    player = Player(name=input.name.strip() or "Bowler")
    await db.players.insert_one(player.dict())
    return player


@api_router.get("/players/{player_id}/stats")
async def player_stats(player_id: str):
    scores = await db.scores.find({"player_id": player_id}).to_list(1000)
    if not scores:
        return {"games": 0, "best": 0, "average": 0, "total_strikes": 0, "wins": 0}
    totals = [s["score"] for s in scores]
    strikes = sum(s.get("strikes", 0) for s in scores)
    wins = sum(1 for s in scores if s.get("result") == "win")
    return {
        "games": len(scores),
        "best": max(totals),
        "average": round(sum(totals) / len(totals)),
        "total_strikes": strikes,
        "wins": wins,
    }


@api_router.post("/scores")
async def submit_score(input: ScoreCreate):
    doc = input.dict()
    doc["id"] = str(uuid.uuid4())
    doc["created_at"] = now_iso()
    await db.scores.insert_one(doc)
    return clean(doc)


@api_router.get("/leaderboard")
async def leaderboard(limit: int = 20):
    scores = await db.scores.find().sort("score", -1).limit(limit).to_list(limit)
    return [clean(s) for s in scores]


# ---------- Multiplayer rooms ----------
@api_router.post("/rooms")
async def create_room(input: RoomCreate):
    code = gen_code()
    while await db.rooms.find_one({"code": code}):
        code = gen_code()
    room = {
        "code": code,
        "status": "waiting",
        "winner": None,
        "created_at": now_iso(),
        "players": [
            {
                "id": input.player_id,
                "name": input.name,
                "score": 0,
                "current_frame": 0,
                "finished": False,
                "is_host": True,
            }
        ],
    }
    await db.rooms.insert_one(room)
    return clean(room)


@api_router.post("/rooms/{code}/join")
async def join_room(code: str, input: RoomJoin):
    code = code.upper()
    room = await db.rooms.find_one({"code": code})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    players = room["players"]
    if not any(p["id"] == input.player_id for p in players):
        if len(players) >= 2:
            raise HTTPException(status_code=400, detail="Room is full")
        players.append({
            "id": input.player_id,
            "name": input.name,
            "score": 0,
            "current_frame": 0,
            "finished": False,
            "is_host": False,
        })
        status = "playing" if len(players) >= 2 else "waiting"
        await db.rooms.update_one(
            {"code": code}, {"$set": {"players": players, "status": status}}
        )
        room["players"] = players
        room["status"] = status
    return clean(room)


@api_router.get("/rooms/{code}")
async def get_room(code: str):
    room = await db.rooms.find_one({"code": code.upper()})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    return clean(room)


@api_router.post("/rooms/{code}/progress")
async def update_progress(code: str, input: RoomProgress):
    code = code.upper()
    room = await db.rooms.find_one({"code": code})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    players = room["players"]
    for p in players:
        if p["id"] == input.player_id:
            p["score"] = input.score
            p["current_frame"] = input.current_frame
            p["finished"] = input.finished
            p["name"] = input.name
    status = room["status"]
    winner = room.get("winner")
    if len(players) >= 2 and all(p["finished"] for p in players):
        status = "finished"
        top = max(players, key=lambda x: x["score"])
        tie = len([p for p in players if p["score"] == top["score"]]) > 1
        winner = "tie" if tie else top["id"]
    elif len(players) >= 2:
        status = "playing"
    await db.rooms.update_one(
        {"code": code},
        {"$set": {"players": players, "status": status, "winner": winner}},
    )
    room["players"] = players
    room["status"] = status
    room["winner"] = winner
    return clean(room)


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
