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

from emergentintegrations.llm.chat import LlmChat, UserMessage


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

AI_MODEL = ("openai", "gpt-5.6-luna")
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")

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


# ---------- AI (GPT-5.6 Luna) ----------
class QuipRequest(BaseModel):
    voice: str = "commentator"  # "commentator" | "cpu"
    event: str = "open"  # strike | spare | gutter | open
    knocked: int = 0
    frame: int = 1
    opp_name: Optional[str] = None
    rival_name: Optional[str] = None
    cpu_wins: int = 0
    player_wins: int = 0
    last_result: Optional[str] = None  # player's perspective: win|lose|tie


class CoachRequest(BaseModel):
    score: int = 0
    strikes: int = 0
    spares: int = 0
    gutters: int = 0
    mode: str = "solo"
    result: Optional[str] = None


class ChatRequest(BaseModel):
    session_id: str
    message: str
    name: Optional[str] = None


def _make_chat(session_id: str, system: str) -> LlmChat:
    return LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=session_id,
        system_message=system,
    ).with_model(*AI_MODEL)


_FALLBACK_QUIP = {
    "strike": "Boom! Right in the pocket!",
    "spare": "Nice clean-up on that spare!",
    "gutter": "Ouch — the gutter strikes again!",
    "open": "Solid roll, keep it rolling!",
}


@api_router.post("/ai/quip")
async def ai_quip(req: QuipRequest):
    if req.voice == "cpu":
        rival = req.rival_name or "the CPU"
        history = ""
        if req.cpu_wins or req.player_wins:
            history = (
                f" Rivalry so far: you (the rival) have won {req.cpu_wins}, the human "
                f"has won {req.player_wins}."
            )
        if req.last_result == "win":
            history += " Last match the human beat you."
        elif req.last_result == "lose":
            history += " Last match you beat the human."
        elif req.last_result == "tie":
            history += " Last match ended in a tie."
        system = (
            f"You are {rival}, the human player's recurring rival in the arcade bowling "
            "game Super Strike — a cocky, playful trash-talker with a memory of your "
            "rivalry. Reply with ONE short taunt or reaction (max 14 words) to the "
            f"human player's shot.{history} Reference the rivalry when it's fun. "
            "PG, funny, never cruel. No quotes, no emojis."
        )
    else:
        system = (
            "You are Luna, a hyped, witty play-by-play commentator for the arcade bowling "
            "game Super Strike. React with ONE punchy line (max 12 words). Fun and PG. "
            "No quotes, no emojis."
        )
    desc = {
        "strike": f"The player just bowled a STRIKE on frame {req.frame}.",
        "spare": f"The player picked up a SPARE on frame {req.frame}.",
        "gutter": f"The player threw a GUTTER ball on frame {req.frame} (0 pins).",
        "open": f"The player knocked down {req.knocked} pins on frame {req.frame}.",
    }.get(req.event, f"The player knocked down {req.knocked} pins.")
    try:
        chat = _make_chat(f"quip-{uuid.uuid4()}", system)
        text = await chat.send_message(UserMessage(text=desc))
        line = (text or "").strip().strip('"').split("\n")[0][:120]
        return {"text": line or _FALLBACK_QUIP.get(req.event, "Nice roll!")}
    except Exception as e:
        logger.warning(f"ai_quip failed: {e}")
        return {"text": _FALLBACK_QUIP.get(req.event, "Nice roll!")}


@api_router.post("/ai/coach")
async def ai_coach(req: CoachRequest):
    system = (
        "You are a friendly, encouraging pro bowling coach in the game Super Strike. "
        "Give ONE specific, actionable tip in 1-2 short sentences based on the player's "
        "game stats (aim, timing, power, or when to use power-ups). No preamble, no lists."
    )
    prompt = (
        f"Game mode: {req.mode}. Final score: {req.score}. Strikes: {req.strikes}. "
        f"Spares: {req.spares}. Gutters: {req.gutters}. "
        f"Result: {req.result or 'n/a'}. Give one coaching tip."
    )
    try:
        chat = _make_chat(f"coach-{uuid.uuid4()}", system)
        text = await chat.send_message(UserMessage(text=prompt))
        return {"text": (text or "").strip() or "Focus on hitting the pocket between the 1 and 3 pins for more strikes!"}
    except Exception as e:
        logger.warning(f"ai_coach failed: {e}")
        return {"text": "Aim for the pocket (between the 1 and 3 pins) and lock your power in the sweet zone for more strikes!"}


@api_router.post("/ai/chat")
async def ai_chat(req: ChatRequest):
    system = (
        "You are Coach Luna, a friendly and witty bowling expert inside the game Super "
        "Strike. Answer the player's bowling questions clearly and concisely (2-4 "
        "sentences). You can talk about technique, rules, scoring, and the game's "
        "power-ups (magnet, giant, muscle, bomb, laser). Keep it upbeat and helpful."
    )
    # store the user message
    await db.ai_chats.insert_one({
        "session_id": req.session_id,
        "role": "user",
        "content": req.message,
        "created_at": now_iso(),
    })
    # build short context from recent history
    history = await db.ai_chats.find({"session_id": req.session_id}).sort("created_at", 1).to_list(20)
    transcript = "\n".join(
        f"{'Player' if m['role'] == 'user' else 'Coach'}: {m['content']}" for m in history[-8:]
    )
    prompt = f"Conversation so far:\n{transcript}\n\nReply to the Player's latest message."
    try:
        chat = _make_chat(req.session_id, system)
        text = (await chat.send_message(UserMessage(text=prompt)) or "").strip()
    except Exception as e:
        logger.warning(f"ai_chat failed: {e}")
        text = "Hmm, my headset cut out! Try asking that again in a moment."
    await db.ai_chats.insert_one({
        "session_id": req.session_id,
        "role": "assistant",
        "content": text,
        "created_at": now_iso(),
    })
    return {"text": text}


@api_router.get("/ai/chat/{session_id}")
async def ai_chat_history(session_id: str):
    msgs = await db.ai_chats.find({"session_id": session_id}).sort("created_at", 1).to_list(200)
    return [{"role": m["role"], "content": m["content"], "created_at": m["created_at"]} for m in msgs]


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
