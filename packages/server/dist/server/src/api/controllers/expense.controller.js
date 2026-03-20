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
exports.listExpenses = listExpenses;
exports.getExpense = getExpense;
exports.createExpense = createExpense;
exports.updateExpense = updateExpense;
exports.deleteExpense = deleteExpense;
exports.approveExpense = approveExpense;
exports.rejectExpense = rejectExpense;
exports.billExpenseToClient = billExpenseToClient;
exports.listCategories = listCategories;
exports.createCategory = createCategory;
const expenseService = __importStar(require("../../services/expense/expense.service"));
async function listExpenses(req, res) {
    const query = req.query;
    const opts = {
        page: parseInt(query.page || "1"),
        limit: parseInt(query.limit || "20"),
        sortOrder: query.sortOrder || "desc",
        categoryId: query.categoryId,
        clientId: query.clientId,
        status: query.status,
        isBillable: query.isBillable !== undefined ? query.isBillable === "true" : undefined,
        from: query.from ? new Date(query.from) : undefined,
        to: query.to ? new Date(query.to) : undefined,
    };
    const result = await expenseService.listExpenses(req.user.orgId, opts);
    res.json({ success: true, data: result.data, meta: { page: result.page, limit: result.limit, total: result.total, totalPages: result.totalPages } });
}
async function getExpense(req, res) {
    const expense = await expenseService.getExpense(req.user.orgId, req.params.id);
    res.json({ success: true, data: expense });
}
async function createExpense(req, res) {
    const expense = await expenseService.createExpense(req.user.orgId, req.user.id, req.body);
    res.status(201).json({ success: true, data: expense });
}
async function updateExpense(req, res) {
    const expense = await expenseService.updateExpense(req.user.orgId, req.params.id, req.body);
    res.json({ success: true, data: expense });
}
async function deleteExpense(req, res) {
    await expenseService.deleteExpense(req.user.orgId, req.params.id);
    res.json({ success: true, data: null });
}
async function approveExpense(req, res) {
    const expense = await expenseService.approveExpense(req.user.orgId, req.params.id, req.user.id);
    res.json({ success: true, data: expense });
}
async function rejectExpense(req, res) {
    const expense = await expenseService.rejectExpense(req.user.orgId, req.params.id);
    res.json({ success: true, data: expense });
}
async function billExpenseToClient(req, res) {
    const result = await expenseService.billExpenseToClient(req.user.orgId, req.params.id, req.user.id);
    res.json({ success: true, data: result });
}
async function listCategories(req, res) {
    const categories = await expenseService.listCategories(req.user.orgId);
    res.json({ success: true, data: categories });
}
async function createCategory(req, res) {
    const category = await expenseService.createCategory(req.user.orgId, req.body);
    res.status(201).json({ success: true, data: category });
}
//# sourceMappingURL=expense.controller.js.map