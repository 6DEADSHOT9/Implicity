from implicity_api.models.agent import Base as AgentBase
from implicity_api.models.app import Base as AppBase
from implicity_api.models.engine import Base as EngineBase
from implicity_api.models.memory import Base as MemoryBase

METADATA = {
    "engine": EngineBase.metadata,
    "memory": MemoryBase.metadata,
    "app": AppBase.metadata,
    "agent": AgentBase.metadata,
}
