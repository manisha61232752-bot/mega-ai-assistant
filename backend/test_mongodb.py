import asyncio
from app.database import users_collection


async def test_users():
    try:
        count = await users_collection.count_documents({})
        print(f"✅ MongoDB Connected!")
        print(f"✅ Users in MongoDB: {count}")

        if count == 128:
            print("🎉 All 128 users successfully verified!")
        else:
            print(f"⚠️ Expected 128 users, but found {count}")

    except Exception as e:
        print("❌ MongoDB Verification Failed!")
        print(e)


if __name__ == "__main__":
    asyncio.run(test_users())