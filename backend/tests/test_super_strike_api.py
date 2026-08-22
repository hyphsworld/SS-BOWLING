"""Backend API tests for Super Strike bowling game."""
import uuid
import pytest


# ---------- Health / root ----------
class TestHealth:
    def test_root(self, api_client, api_url):
        r = api_client.get(f"{api_url}/")
        assert r.status_code == 200
        assert "message" in r.json()


# ---------- Players ----------
class TestPlayers:
    def test_create_player(self, api_client, api_url):
        payload = {"name": "TEST_Player1"}
        r = api_client.post(f"{api_url}/players", json=payload)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["name"] == "TEST_Player1"
        assert "id" in data and len(data["id"]) > 0
        assert "created_at" in data

    def test_create_player_empty_name_defaults_to_bowler(self, api_client, api_url):
        r = api_client.post(f"{api_url}/players", json={"name": "  "})
        assert r.status_code == 200
        assert r.json()["name"] == "Bowler"

    def test_new_player_stats_default(self, api_client, api_url):
        r = api_client.post(f"{api_url}/players", json={"name": "TEST_StatsUser"})
        pid = r.json()["id"]
        s = api_client.get(f"{api_url}/players/{pid}/stats")
        assert s.status_code == 200
        stats = s.json()
        assert stats == {"games": 0, "best": 0, "average": 0, "total_strikes": 0, "wins": 0}


# ---------- Scores + Leaderboard ----------
class TestScoresLeaderboard:
    def test_submit_score_and_leaderboard(self, api_client, api_url):
        # create player
        pr = api_client.post(f"{api_url}/players", json={"name": "TEST_LB_User"})
        pid = pr.json()["id"]

        payload = {
            "player_id": pid,
            "name": "TEST_LB_User",
            "score": 275,
            "mode": "solo",
            "strikes": 8,
            "spares": 2,
            "result": "win",
        }
        r = api_client.post(f"{api_url}/scores", json=payload)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["score"] == 275
        assert body["strikes"] == 8
        assert "id" in body
        assert "_id" not in body

        # Leaderboard should include it, sorted desc
        lb = api_client.get(f"{api_url}/leaderboard?limit=50")
        assert lb.status_code == 200
        rows = lb.json()
        assert isinstance(rows, list)
        assert any(x.get("player_id") == pid and x.get("score") == 275 for x in rows)
        scores = [x["score"] for x in rows]
        assert scores == sorted(scores, reverse=True), "leaderboard must be desc"
        # ensure _id not in any row
        for row in rows:
            assert "_id" not in row

    def test_player_stats_after_scores(self, api_client, api_url):
        pr = api_client.post(f"{api_url}/players", json={"name": "TEST_Stats_Agg"})
        pid = pr.json()["id"]
        for s, res, strikes in [(100, "lose", 1), (200, "win", 5), (150, "win", 3)]:
            api_client.post(
                f"{api_url}/scores",
                json={
                    "player_id": pid,
                    "name": "TEST_Stats_Agg",
                    "score": s,
                    "mode": "cpu",
                    "strikes": strikes,
                    "spares": 0,
                    "result": res,
                },
            )
        s = api_client.get(f"{api_url}/players/{pid}/stats").json()
        assert s["games"] == 3
        assert s["best"] == 200
        assert s["average"] == 150  # (100+200+150)/3
        assert s["total_strikes"] == 9
        assert s["wins"] == 2


# ---------- Multiplayer Rooms ----------
class TestRooms:
    def _mkplayer(self, api_client, api_url, name):
        return api_client.post(f"{api_url}/players", json={"name": name}).json()

    def test_full_room_flow(self, api_client, api_url):
        host = self._mkplayer(api_client, api_url, "TEST_Host")
        guest = self._mkplayer(api_client, api_url, "TEST_Guest")

        # Create
        cr = api_client.post(
            f"{api_url}/rooms", json={"player_id": host["id"], "name": host["name"]}
        )
        assert cr.status_code == 200, cr.text
        room = cr.json()
        assert len(room["code"]) == 4
        assert room["status"] == "waiting"
        assert len(room["players"]) == 1
        assert room["players"][0]["is_host"] is True
        assert room["winner"] is None
        assert "_id" not in room
        code = room["code"]

        # GET room
        g = api_client.get(f"{api_url}/rooms/{code}")
        assert g.status_code == 200
        assert g.json()["code"] == code

        # Join
        jr = api_client.post(
            f"{api_url}/rooms/{code}/join",
            json={"player_id": guest["id"], "name": guest["name"]},
        )
        assert jr.status_code == 200, jr.text
        rj = jr.json()
        assert rj["status"] == "playing"
        assert len(rj["players"]) == 2
        assert any(p["id"] == guest["id"] and not p["is_host"] for p in rj["players"])

        # Progress: host finishes 200
        pr1 = api_client.post(
            f"{api_url}/rooms/{code}/progress",
            json={
                "player_id": host["id"],
                "name": host["name"],
                "score": 200,
                "current_frame": 10,
                "finished": True,
            },
        )
        assert pr1.status_code == 200
        assert pr1.json()["status"] == "playing"

        # Progress: guest finishes 150 -> finished, host wins
        pr2 = api_client.post(
            f"{api_url}/rooms/{code}/progress",
            json={
                "player_id": guest["id"],
                "name": guest["name"],
                "score": 150,
                "current_frame": 10,
                "finished": True,
            },
        )
        assert pr2.status_code == 200
        body = pr2.json()
        assert body["status"] == "finished"
        assert body["winner"] == host["id"]

    def test_room_tie(self, api_client, api_url):
        host = api_client.post(f"{api_url}/players", json={"name": "TEST_T1"}).json()
        guest = api_client.post(f"{api_url}/players", json={"name": "TEST_T2"}).json()
        room = api_client.post(
            f"{api_url}/rooms", json={"player_id": host["id"], "name": host["name"]}
        ).json()
        code = room["code"]
        api_client.post(
            f"{api_url}/rooms/{code}/join",
            json={"player_id": guest["id"], "name": guest["name"]},
        )
        api_client.post(
            f"{api_url}/rooms/{code}/progress",
            json={
                "player_id": host["id"],
                "name": host["name"],
                "score": 120,
                "current_frame": 10,
                "finished": True,
            },
        )
        r = api_client.post(
            f"{api_url}/rooms/{code}/progress",
            json={
                "player_id": guest["id"],
                "name": guest["name"],
                "score": 120,
                "current_frame": 10,
                "finished": True,
            },
        )
        assert r.status_code == 200
        assert r.json()["winner"] == "tie"
        assert r.json()["status"] == "finished"

    def test_join_nonexistent_room_404(self, api_client, api_url):
        p = api_client.post(f"{api_url}/players", json={"name": "TEST_NF"}).json()
        r = api_client.post(
            f"{api_url}/rooms/ZZZZ/join",
            json={"player_id": p["id"], "name": p["name"]},
        )
        assert r.status_code == 404

    def test_get_nonexistent_room_404(self, api_client, api_url):
        r = api_client.get(f"{api_url}/rooms/ZZZZ")
        assert r.status_code == 404

    def test_full_room_third_player_400(self, api_client, api_url):
        h = api_client.post(f"{api_url}/players", json={"name": "TEST_F1"}).json()
        g = api_client.post(f"{api_url}/players", json={"name": "TEST_F2"}).json()
        t = api_client.post(f"{api_url}/players", json={"name": "TEST_F3"}).json()
        room = api_client.post(
            f"{api_url}/rooms", json={"player_id": h["id"], "name": h["name"]}
        ).json()
        code = room["code"]
        api_client.post(
            f"{api_url}/rooms/{code}/join",
            json={"player_id": g["id"], "name": g["name"]},
        )
        r = api_client.post(
            f"{api_url}/rooms/{code}/join",
            json={"player_id": t["id"], "name": t["name"]},
        )
        assert r.status_code == 400

    def test_rejoin_existing_player_is_idempotent(self, api_client, api_url):
        """Host re-hitting join for their own code should not add a duplicate or 400."""
        h = api_client.post(f"{api_url}/players", json={"name": "TEST_Rejoin"}).json()
        room = api_client.post(
            f"{api_url}/rooms", json={"player_id": h["id"], "name": h["name"]}
        ).json()
        code = room["code"]
        r = api_client.post(
            f"{api_url}/rooms/{code}/join",
            json={"player_id": h["id"], "name": h["name"]},
        )
        assert r.status_code == 200
        assert len(r.json()["players"]) == 1
