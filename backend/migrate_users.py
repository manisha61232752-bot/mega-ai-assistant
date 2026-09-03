import json
import asyncio
from pathlib import Path

from app.database import users_collection


USERS_FILE = Path(__file__).parent / "app" / "users.json"


async def migrate_users():
    if not USERS_FILE.exists():
        print(f"❌ users.json nahi mila: {USERS_FILE}")
        return

    with open(USERS_FILE, "r", encoding="utf-8") as f:
        users = json.load(f)

    if not isinstance(users, list):
        print("❌ users.json ka format list nahi hai.")
        return

    inserted = 0
    skipped = 0

    for user in users:
        user_id = user.get("id")

        if not user_id:
            print("⚠️ User ID missing, skipping user.")
            skipped += 1
            continue

        existing = await users_collection.find_one({"id": user_id})

        if existing:
            skipped += 1
            continue

        await users_collection.insert_one(user)
        inserted += 1

    print("\n========== MIGRATION COMPLETE ==========")
    print(f"Total users found : {len(users)}")
    print(f"Inserted          : {inserted}")
    print(f"Skipped           : {skipped}")
    print("========================================")


if __name__ == "__main__":
    asyncio.run(migrate_users())