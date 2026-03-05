/**
 * EduGuardian 2.0 - WebSocket Client
 * STOMP over SockJS for real-time proctor event streaming.
 *
 * Uses SockJS transport (matching backend's .withSockJS() config)
 * with graceful degradation — if WebSocket fails, the app still
 * works via HTTP polling.
 */
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client/dist/sockjs';

class WebSocketService {
    constructor() {
        this.client = null;
        this.subscriptions = {};
        this.connected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.queue = []; // Queue for subscriptions made before connection
    }

    connect(onConnect, onError) {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.warn('[WebSocket] Max reconnect attempts reached — falling back to HTTP polling');
            return;
        }

        if (this.client && (this.connected || this.client.active)) {
            return;
        }

        try {
            this.client = new Client({
                webSocketFactory: () => new SockJS('http://localhost:8080/ws'),
                reconnectDelay: 5000,
                heartbeatIncoming: 4000,
                heartbeatOutgoing: 4000,

                onConnect: () => {
                    this.connected = true;
                    this.reconnectAttempts = 0;
                    console.log('[WebSocket] Connected via SockJS');

                    // Process queued subscriptions
                    console.log(`[WebSocket] Processing ${this.queue.length} queued subscriptions`);
                    while (this.queue.length > 0) {
                        const { dest, callback } = this.queue.shift();
                        this._executeSubscribe(dest, callback);
                    }

                    if (onConnect) onConnect();
                },

                onStompError: (frame) => {
                    console.error('[WebSocket] STOMP error:', frame.headers?.message);
                    if (onError) onError(frame);
                },

                onDisconnect: () => {
                    this.connected = false;
                    console.log('[WebSocket] Disconnected');
                },

                onWebSocketClose: () => {
                    this.connected = false;
                    this.reconnectAttempts++;
                    console.log(`[WebSocket] Closed (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
                    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
                        console.warn('[WebSocket] Giving up — app will use HTTP polling instead');
                        this.disconnect();
                    }
                },
            });

            this.client.activate();
        } catch (err) {
            console.warn('[WebSocket] Failed to create or activate client:', err.message);
        }
    }

    _executeSubscribe(dest, onEvent) {
        try {
            if (!this.client || !this.connected) return;
            this.subscriptions[dest] = this.client.subscribe(dest, (message) => {
                try {
                    const event = JSON.parse(message.body);
                    onEvent(event);
                } catch (e) {
                    console.error(`[WebSocket] Failed to parse message from ${dest}:`, e);
                }
            });
        } catch (err) {
            console.error(`[WebSocket] Subscription error for ${dest}:`, err.message);
        }
    }

    subscribeToExam(examId, onEvent) {
        const dest = `/topic/exam/${examId}`;
        if (this.connected) {
            this._executeSubscribe(dest, onEvent);
        } else {
            this.queue.push({ dest, callback: onEvent });
        }
        return () => this.unsubscribe(dest);
    }

    subscribeToAlerts(examId, onAlert) {
        const dest = `/topic/exam/${examId}/alerts`;
        if (this.connected) {
            this._executeSubscribe(dest, onAlert);
        } else {
            this.queue.push({ dest, callback: onAlert });
        }
        return () => this.unsubscribe(dest);
    }

    subscribeToRiskUpdates(examId, studentId, onUpdate) {
        const dest = `/topic/exam/${examId}/student/${studentId}/risk`;
        if (this.connected) {
            this._executeSubscribe(dest, onUpdate);
        } else {
            this.queue.push({ dest, callback: onUpdate });
        }
        return () => this.unsubscribe(dest);
    }

    subscribeToProctorEvents(onEvent) {
        const dest = '/topic/proctor-events';
        if (this.connected) {
            this._executeSubscribe(dest, onEvent);
        } else {
            this.queue.push({ dest, callback: onEvent });
        }
        return () => this.unsubscribe(dest);
    }

    sendEvent(event) {
        try {
            if (this.client && this.connected) {
                this.client.publish({
                    destination: '/app/proctor.event',
                    body: JSON.stringify(event),
                });
            }
        } catch (err) {
            console.warn('[WebSocket] Publish event error:', err.message);
        }
    }

    sendRiskUpdate(event) {
        try {
            if (this.client && this.connected) {
                this.client.publish({
                    destination: '/app/risk.update',
                    body: JSON.stringify(event),
                });
            }
        } catch (err) {
            console.warn('[WebSocket] Publish risk update error:', err.message);
        }
    }

    unsubscribe(dest) {
        try {
            if (this.subscriptions[dest]) {
                this.subscriptions[dest].unsubscribe();
                delete this.subscriptions[dest];
            }
            // Also remove from queue if it hasn't been processed yet
            this.queue = this.queue.filter(item => item.dest !== dest);
        } catch (err) {
            console.warn(`[WebSocket] Unsubscribe error for ${dest}:`, err.message);
        }
    }

    disconnect() {
        if (this.client) {
            try {
                this.client.deactivate();
            } catch (err) {
                console.warn('[WebSocket] Deactivate error:', err.message);
            }
            this.connected = false;
            this.queue = [];
        }
    }

    isConnected() {
        return this.connected;
    }
}

export const wsService = new WebSocketService();
