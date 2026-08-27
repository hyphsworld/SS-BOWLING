"""AI endpoint tests for Super Strike (GPT-5.6 Luna via emergentintegrations).
Verifies /api/ai/quip, /api/ai/coach, /api/ai/chat, /api/ai/chat/{session_id}.
AI calls hit a real LLM so responses take ~1-4s. Even on model errors, endpoints
must return a graceful non-empty {text}.
"""
import uuid
import pytest


class TestAIQuip:
    def test_commentator_strike(self, api_client, api_url):
        r = api_client.post(
            f"{api_url}/ai/quip",
            json={"voice": "commentator", "event": "strike", "frame": 3, "knocked": 10},
            timeout=30,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert "text" in body
        assert isinstance(body["text"], str)
        assert len(body["text"].strip()) > 0

    def test_cpu_gutter(self, api_client, api_url):
        r = api_client.post(
            f"{api_url}/ai/quip",
            json={"voice": "cpu", "event": "gutter", "frame": 1, "knocked": 0, "opp_name": "CPU"},
            timeout=30,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert "text" in body and len(body["text"].strip()) > 0

    def test_cpu_rivalry_strike(self, api_client, api_url):
        """Iter6: CPU voice with rivalry fields (rival_name, cpu_wins, player_wins, last_result)."""
        r = api_client.post(
            f"{api_url}/ai/quip",
            json={
                "voice": "cpu",
                "event": "strike",
                "frame": 4,
                "knocked": 10,
                "rival_name": "Neon Nikki",
                "cpu_wins": 2,
                "player_wins": 1,
                "last_result": "lose",
            },
            timeout=30,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert "text" in body
        assert isinstance(body["text"], str)
        assert len(body["text"].strip()) > 0

    def test_commentator_spare(self, api_client, api_url):
        r = api_client.post(
            f"{api_url}/ai/quip",
            json={"voice": "commentator", "event": "spare", "frame": 5, "knocked": 4},
            timeout=30,
        )
        assert r.status_code == 200
        assert len(r.json().get("text", "").strip()) > 0


class TestAICoach:
    def test_coach_tip_solo(self, api_client, api_url):
        r = api_client.post(
            f"{api_url}/ai/coach",
            json={"score": 145, "strikes": 3, "spares": 2, "gutters": 1, "mode": "solo"},
            timeout=30,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert "text" in body
        assert isinstance(body["text"], str)
        assert len(body["text"].strip()) > 0

    def test_coach_tip_cpu_result(self, api_client, api_url):
        r = api_client.post(
            f"{api_url}/ai/coach",
            json={"score": 90, "strikes": 1, "spares": 1, "gutters": 4, "mode": "cpu", "result": "lose"},
            timeout=30,
        )
        assert r.status_code == 200
        assert len(r.json().get("text", "").strip()) > 0


class TestAIChat:
    def test_chat_send_and_history_order(self, api_client, api_url):
        session_id = f"TEST_session_{uuid.uuid4()}"
        # First message
        r1 = api_client.post(
            f"{api_url}/ai/chat",
            json={"session_id": session_id, "message": "How do I get more strikes?"},
            timeout=30,
        )
        assert r1.status_code == 200, r1.text
        b1 = r1.json()
        assert "text" in b1 and len(b1["text"].strip()) > 0

        # Second message continues conversation
        r2 = api_client.post(
            f"{api_url}/ai/chat",
            json={"session_id": session_id, "message": "And how does scoring a spare work?"},
            timeout=30,
        )
        assert r2.status_code == 200
        b2 = r2.json()
        assert len(b2["text"].strip()) > 0

        # GET history returns messages in chronological order alternating user/assistant
        h = api_client.get(f"{api_url}/ai/chat/{session_id}", timeout=15)
        assert h.status_code == 200
        msgs = h.json()
        assert isinstance(msgs, list)
        # Expect 4 messages: user, assistant, user, assistant
        assert len(msgs) == 4, f"expected 4 messages, got {len(msgs)}: {msgs}"
        roles = [m["role"] for m in msgs]
        assert roles == ["user", "assistant", "user", "assistant"], roles
        assert msgs[0]["content"] == "How do I get more strikes?"
        assert msgs[2]["content"] == "And how does scoring a spare work?"
        # All content non-empty and no _id leak
        for m in msgs:
            assert "_id" not in m
            assert isinstance(m["content"], str)
            assert len(m["content"]) > 0
        # created_at sorted ascending
        created = [m["created_at"] for m in msgs]
        assert created == sorted(created), "history must be sorted ascending"

    def test_chat_empty_history_for_new_session(self, api_client, api_url):
        session_id = f"TEST_empty_{uuid.uuid4()}"
        r = api_client.get(f"{api_url}/ai/chat/{session_id}", timeout=15)
        assert r.status_code == 200
        assert r.json() == []
