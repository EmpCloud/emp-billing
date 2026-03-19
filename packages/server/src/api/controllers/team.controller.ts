import type { Request, Response } from "express";
import * as teamService from "../../services/team/team.service";

export async function listMembers(
  req: Request,
  res: Response
): Promise<void> {
  const members = await teamService.listMembers(req.user!.orgId);
  res.json({ success: true, data: members });
}

export async function inviteMember(
  req: Request,
  res: Response
): Promise<void> {
  const member = await teamService.inviteMember(
    req.user!.orgId,
    req.user!.id,
    req.body
  );
  res.status(201).json({ success: true, data: member });
}

export async function updateMemberRole(
  req: Request,
  res: Response
): Promise<void> {
  const member = await teamService.updateMemberRole(
    req.user!.orgId,
    req.params.userId as string,
    req.user!.role,
    req.body
  );
  res.json({ success: true, data: member });
}

export async function removeMember(
  req: Request,
  res: Response
): Promise<void> {
  await teamService.removeMember(
    req.user!.orgId,
    req.params.userId as string,
    req.user!.id
  );
  res.json({ success: true, data: null });
}
