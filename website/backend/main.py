from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.database import init_db, engine
from app.routers import auth, repo, profile, pages

# Lifespan context manager
@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Starting up...")
    init_db()
    yield
    print("Shutting down...")
    engine.dispose()

# Create FastAPI app
app = FastAPI(lifespan=lifespan)

# CORS middleware
origins = [
    "http://localhost:5173",
    "http://localhost:3000",
    "https://pmg-tuie.onrender.com"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router)
app.include_router(repo.router)
app.include_router(profile.router)
app.include_router(pages.router)

@app.get("/")
def root() -> dict[str, str]:
    return {
        "message": "Hey, you have accessed the root endpoint of PMG, which unfortunately does nothing. Would recommend you check the docs. Have a great day/night :D"
    }
