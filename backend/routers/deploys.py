from fastapi import APIRouter, Query
from pydantic import BaseModel
from typing import Optional
from backend.services.deploy_tracker import (
    record_deploy, list_deploys, get_deploy, get_deploys_for_chart, delete_deploy,
)

router = APIRouter()


class DeployInput(BaseModel):
    service: str
    version: str
    environment: str = "production"
    deployer: str = "system"
    description: str = ""
    commit_sha: str = ""
    status: str = "success"


@router.get("")
async def get_deploys(
    service: Optional[str] = None,
    environment: Optional[str] = None,
    hours: Optional[float] = None,
    limit: int = Query(50, le=200),
):
    deploys = list_deploys(service=service, environment=environment, limit=limit, hours=hours)
    return {"deploys": deploys, "count": len(deploys)}


@router.post("")
async def create_deploy(deploy: DeployInput):
    result = record_deploy(
        service=deploy.service,
        version=deploy.version,
        environment=deploy.environment,
        deployer=deploy.deployer,
        description=deploy.description,
        commit_sha=deploy.commit_sha,
        status=deploy.status,
    )
    return result


@router.get("/chart/{service}")
async def get_chart_deploys(service: str, hours: float = Query(24)):
    deploys = get_deploys_for_chart(service, hours)
    return {"deploys": deploys}


@router.get("/{deploy_id}")
async def get_deploy_detail(deploy_id: str):
    deploy = get_deploy(deploy_id)
    if not deploy:
        return {"error": "Deploy not found"}, 404
    return deploy


@router.delete("/{deploy_id}")
async def remove_deploy(deploy_id: str):
    success = delete_deploy(deploy_id)
    return {"deleted": success}
