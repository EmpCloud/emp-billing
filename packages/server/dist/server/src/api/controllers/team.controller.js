"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.listMembers = listMembers;
exports.inviteMember = inviteMember;
exports.updateMemberRole = updateMemberRole;
exports.removeMember = removeMember;
const teamService = __importStar(require("../../services/team/team.service"));
async function listMembers(req, res) {
    const members = await teamService.listMembers(req.user.orgId);
    res.json({ success: true, data: members });
}
async function inviteMember(req, res) {
    const member = await teamService.inviteMember(req.user.orgId, req.user.id, req.body);
    res.status(201).json({ success: true, data: member });
}
async function updateMemberRole(req, res) {
    const member = await teamService.updateMemberRole(req.user.orgId, req.params.userId, req.user.role, req.body);
    res.json({ success: true, data: member });
}
async function removeMember(req, res) {
    await teamService.removeMember(req.user.orgId, req.params.userId, req.user.id);
    res.json({ success: true, data: null });
}
//# sourceMappingURL=team.controller.js.map