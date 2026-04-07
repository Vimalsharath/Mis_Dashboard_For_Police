"""
NLP Feedback Sensitivity Classifier
Uses TextBlob sentiment + keyword rule engine to classify police feedback.
No external API required.
"""
from textblob import TextBlob
import re

# Weighted keyword sets
CRITICAL_KEYWORDS = [
    "rape", "sexual assault", "torture", "bribe", "extortion", "killed",
    "murder", "brutality", "beaten to death", "false imprisonment",
    "planted evidence", "illegal detention", "corruption", "blackmail",
    "threatening family", "custodial death"
]

HIGH_KEYWORDS = [
    "assault", "beat", "hit", "slap", "abuse", "drunk", "rude", "threat",
    "misbehave", "harass", "misuse", "negligent", "incompetent", "drunk on duty",
    "bribery", "money", "paid", "demand", "refused to file", "denied help",
    "inappropriate", "misconduct", "unprofessional"
]

MEDIUM_KEYWORDS = [
    "late", "slow", "delay", "ignored", "dismissive", "unhelpful",
    "impolite", "careless", "did not respond", "not cooperative",
    "poor service", "attitude", "annoyed", "frustrating", "bad behavior"
]


def classify_sensitivity(text: str) -> dict:
    """
    Returns:
        {
            "sensitivity": "low" | "medium" | "high" | "critical",
            "score": float 0-1,
            "keywords_found": list[str],
            "sentiment_polarity": float
        }
    """
    text_lower = text.lower()
    blob = TextBlob(text)
    polarity = blob.sentiment.polarity  # -1 (very negative) to +1 (very positive)

    keywords_found = []
    level = "low"
    score = 0.0

    # Check critical keywords first
    for kw in CRITICAL_KEYWORDS:
        if re.search(r'\b' + re.escape(kw) + r'\b', text_lower):
            keywords_found.append(kw)
            level = "critical"
            score = max(score, 1.0)

    if level != "critical":
        for kw in HIGH_KEYWORDS:
            if re.search(r'\b' + re.escape(kw) + r'\b', text_lower):
                keywords_found.append(kw)
                if level != "high":
                    level = "high"
                score = max(score, 0.75)

    if level not in ("critical", "high"):
        for kw in MEDIUM_KEYWORDS:
            if re.search(r'\b' + re.escape(kw) + r'\b', text_lower):
                keywords_found.append(kw)
                if level != "medium":
                    level = "medium"
                score = max(score, 0.45)

    # Sentiment boost — very negative text upgrades sensitivity
    if polarity < -0.5 and level == "low":
        level = "medium"
        score = max(score, 0.35)
    elif polarity < -0.7 and level == "medium":
        level = "high"
        score = max(score, 0.65)

    if level == "low" and score == 0.0:
        # Normalize score from polarity
        score = max(0.0, min(0.2, abs(polarity) * 0.2))

    return {
        "sensitivity": level,
        "score": round(score, 3),
        "keywords_found": list(set(keywords_found)),
        "sentiment_polarity": round(polarity, 3)
    }


def should_notify_higher_officer(sensitivity: str) -> bool:
    return sensitivity in ("high", "critical")
