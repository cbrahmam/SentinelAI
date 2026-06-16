from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
from backend.services.alert_rules import (
    create_rule, list_rules, get_rule, update_rule, delete_rule, toggle_rule, evaluate_rules,
)

router = APIRouter()


class RuleInput(BaseModel):
    name: str
    service: str
    metric_name: str
    condition: str = "above"
    threshold: float
    severity: str = "warning"
    duration_seconds: int = 0
    notification_channels: list[str] = []


class RuleUpdate(BaseModel):
    name: Optional[str] = None
    service: Optional[str] = None
    metric_name: Optional[str] = None
    condition: Optional[str] = None
    threshold: Optional[float] = None
    severity: Optional[str] = None
    duration_seconds: Optional[int] = None
    enabled: Optional[bool] = None
    notification_channels: Optional[list[str]] = None


@router.get("")
async def get_rules(service: Optional[str] = None, enabled_only: bool = False):
    rules = list_rules(service=service, enabled_only=enabled_only)
    return {"rules": rules, "count": len(rules)}


@router.post("")
async def add_rule(rule: RuleInput):
    result = create_rule(
        name=rule.name,
        service=rule.service,
        metric_name=rule.metric_name,
        condition=rule.condition,
        threshold=rule.threshold,
        severity=rule.severity,
        duration_seconds=rule.duration_seconds,
        notification_channels=rule.notification_channels,
    )
    return result


@router.get("/evaluate")
async def run_evaluation():
    triggered = evaluate_rules()
    return {"triggered": triggered, "count": len(triggered)}


@router.get("/{rule_id}")
async def get_rule_detail(rule_id: str):
    rule = get_rule(rule_id)
    if not rule:
        return {"error": "Rule not found"}
    return rule


@router.put("/{rule_id}")
async def modify_rule(rule_id: str, updates: RuleUpdate):
    update_dict = {k: v for k, v in updates.model_dump().items() if v is not None}
    result = update_rule(rule_id, update_dict)
    if not result:
        return {"error": "Rule not found"}
    return result


@router.put("/{rule_id}/toggle")
async def toggle_rule_endpoint(rule_id: str):
    result = toggle_rule(rule_id)
    if not result:
        return {"error": "Rule not found"}
    return result


@router.delete("/{rule_id}")
async def remove_rule(rule_id: str):
    success = delete_rule(rule_id)
    return {"deleted": success}
