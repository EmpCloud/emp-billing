"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emitter = void 0;
exports.emit = emit;
exports.on = on;
const events_1 = require("events");
// ── Emitter ─────────────────────────────────────────────────────────────────
const emitter = new events_1.EventEmitter();
exports.emitter = emitter;
function emit(event, payload) {
    emitter.emit(event, payload);
}
function on(event, handler) {
    emitter.on(event, handler);
}
//# sourceMappingURL=index.js.map