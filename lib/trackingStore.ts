import * as Location from "expo-location";
import { Accelerometer } from "expo-sensors";

// ─── Shared types ─────────────────────────────────────────────────────────────

export interface RouteWaypoint {
    lat: number; lng: number; speedKmh: number; ts: number;
}

export interface RouteStop {
    lat: number; lng: number; ts: number; index: number;
}

export interface RouteFieldData {
    startTime: number; endTime: number;
    distanceKm: number;
    avgSpeedKmh: number; topSpeedKmh: number; minSpeedKmh: number;
    waypoints: RouteWaypoint[];
    stops: RouteStop[];
    destination: { lat: number; lng: number } | null;
}

export interface AccelFieldData {
    durationSec: number; rms: number; peak: number; avgMagnitude: number; category: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
    const R = 6371;
    const dLat = (b.lat - a.lat) * (Math.PI / 180);
    const dLng = (b.lng - a.lng) * (Math.PI / 180);
    const x =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(a.lat * (Math.PI / 180)) *
        Math.cos(b.lat * (Math.PI / 180)) *
        Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

// ─── Singleton store ──────────────────────────────────────────────────────────
// Lives outside React — subscriptions survive component unmounts.

class TrackingStore {
    // Route state (read by components)
    routeStatus: "idle" | "tracking" | "completed" = "idle";
    routeStartTime = 0;
    routeElapsed = 0;
    routeDistance = 0;
    routeLiveSpeed = 0;
    routeWaypoints: RouteWaypoint[] = [];
    routeResult: RouteFieldData | null = null;

    // Stop & destination state
    routeStops: RouteStop[] = [];
    routeDestination: { lat: number; lng: number } | null = null;
    routeEtaSec: number | null = null;

    private _routeSpeeds: number[] = [];
    private _routeLastPos: { lat: number; lng: number } | null = null;
    private _routeSub: Location.LocationSubscription | null = null;
    private _routeTimer: ReturnType<typeof setInterval> | null = null;

    // Timer state (read by components)
    timerStatus: "idle" | "running" | "completed" = "idle";
    timerStartTime = 0;
    timerElapsed = 0;
    timerResult: number | null = null;

    private _timerInterval: ReturnType<typeof setInterval> | null = null;

    // Accel state (read by components)
    accelStatus: "idle" | "sampling" | "completed" = "idle";
    accelStartTime = 0;
    accelElapsed = 0;
    accelLiveMag = 0;
    accelSampleCount = 0;
    accelResult: AccelFieldData | null = null;

    private _accelSamples: number[] = [];
    private _accelSub: ReturnType<typeof Accelerometer.addListener> | null = null;
    private _accelTimer: ReturnType<typeof setInterval> | null = null;

    // Listener registry
    private _listeners = new Set<() => void>();

    subscribe(fn: () => void): () => void {
        this._listeners.add(fn);
        return () => { this._listeners.delete(fn); };
    }

    private notify() {
        this._listeners.forEach((fn) => fn());
    }

    // ── Route actions ─────────────────────────────────────────────────────────

    async startRoute(): Promise<boolean> {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") return false;

        this.routeWaypoints = [];
        this._routeSpeeds = [];
        this._routeLastPos = null;
        this.routeDistance = 0;
        this.routeLiveSpeed = 0;
        this.routeStartTime = Date.now();
        this.routeElapsed = 0;
        this.routeResult = null;
        this.routeStops = [];
        this.routeEtaSec = null;
        this.routeStatus = "tracking";
        this.notify();

        this._routeSub = await Location.watchPositionAsync(
            { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1000, distanceInterval: 5 },
            (loc) => {
                const { latitude, longitude, speed } = loc.coords;
                const speedKmh = Math.max(0, (speed ?? 0) * 3.6);
                this.routeWaypoints.push({ lat: latitude, lng: longitude, speedKmh, ts: loc.timestamp });
                this._routeSpeeds.push(speedKmh);
                this.routeLiveSpeed = Math.round(speedKmh);
                if (this._routeLastPos) {
                    this.routeDistance += haversineKm(
                        this._routeLastPos,
                        { lat: latitude, lng: longitude },
                    );
                }
                this._routeLastPos = { lat: latitude, lng: longitude };

                // ETA: remaining distance / current avg speed
                if (this.routeDestination && this._routeLastPos) {
                    const remainKm = haversineKm(this._routeLastPos, this.routeDestination);
                    const moving = this._routeSpeeds.filter((s) => s > 0.5);
                    const avgKmh = moving.length
                        ? moving.reduce((a, b) => a + b, 0) / moving.length
                        : 0;
                    this.routeEtaSec = avgKmh > 0.5
                        ? Math.round((remainKm / avgKmh) * 3600)
                        : null;
                } else {
                    this.routeEtaSec = null;
                }

                this.notify();
            },
        );

        this._routeTimer = setInterval(() => {
            this.routeElapsed = Math.floor((Date.now() - this.routeStartTime) / 1000);
            this.notify();
        }, 1000);

        return true;
    }

    recordStop() {
        if (!this._routeLastPos) return;
        this.routeStops.push({
            ...this._routeLastPos,
            ts: Date.now(),
            index: this.routeStops.length + 1,
        });
        this.notify();
    }

    setDestination(lat: number, lng: number) {
        this.routeDestination = { lat, lng };
        this.routeEtaSec = null;
        this.notify();
    }

    clearDestination() {
        this.routeDestination = null;
        this.routeEtaSec = null;
        this.notify();
    }

    stopRoute(): RouteFieldData {
        this._routeSub?.remove(); this._routeSub = null;
        if (this._routeTimer) { clearInterval(this._routeTimer); this._routeTimer = null; }

        const moving = this._routeSpeeds.filter((s) => s > 0.5);
        this.routeResult = {
            startTime: this.routeStartTime,
            endTime: Date.now(),
            distanceKm: Math.round(this.routeDistance * 100) / 100,
            avgSpeedKmh: moving.length ? Math.round(moving.reduce((a, b) => a + b, 0) / moving.length) : 0,
            topSpeedKmh: moving.length ? Math.round(Math.max(...moving)) : 0,
            minSpeedKmh: moving.length ? Math.round(Math.min(...moving)) : 0,
            waypoints: this.routeWaypoints,
            stops: this.routeStops,
            destination: this.routeDestination,
        };
        this.routeStatus = "completed";
        this.notify();
        return this.routeResult;
    }

    cancelRoute() {
        this._routeSub?.remove(); this._routeSub = null;
        if (this._routeTimer) { clearInterval(this._routeTimer); this._routeTimer = null; }
        this.routeStatus = "idle";
        this.routeResult = null;
        this.routeStops = [];
        this.routeEtaSec = null;
        this.notify();
    }

    resetRoute() {
        this.cancelRoute();
        this.routeDistance = 0;
        this.routeLiveSpeed = 0;
        this.routeElapsed = 0;
        this.routeWaypoints = [];
        this._routeSpeeds = [];
        this.routeDestination = null;
        this.notify();
    }

    // ── Session timer actions ─────────────────────────────────────────────────

    startTimer() {
        this.timerStartTime = Date.now();
        this.timerElapsed = 0;
        this.timerResult = null;
        this.timerStatus = "running";
        this.notify();

        this._timerInterval = setInterval(() => {
            this.timerElapsed = Math.floor((Date.now() - this.timerStartTime) / 1000);
            this.notify();
        }, 1000);
    }

    stopTimer(): number {
        if (this._timerInterval) { clearInterval(this._timerInterval); this._timerInterval = null; }
        this.timerResult = Math.floor((Date.now() - this.timerStartTime) / 1000);
        this.timerElapsed = this.timerResult;
        this.timerStatus = "completed";
        this.notify();
        return this.timerResult;
    }

    cancelTimer() {
        if (this._timerInterval) { clearInterval(this._timerInterval); this._timerInterval = null; }
        this.timerStatus = "idle";
        this.timerResult = null;
        this.notify();
    }

    resetTimer() {
        this.cancelTimer();
        this.timerElapsed = 0;
        this.notify();
    }

    // ── Accelerometer actions ─────────────────────────────────────────────────

    startAccel() {
        this._accelSamples = [];
        this.accelStartTime = Date.now();
        this.accelElapsed = 0;
        this.accelLiveMag = 0;
        this.accelSampleCount = 0;
        this.accelResult = null;
        this.accelStatus = "sampling";
        this.notify();

        Accelerometer.setUpdateInterval(100);
        this._accelSub = Accelerometer.addListener(({ x, y, z }) => {
            const mag = Math.sqrt(x * x + y * y + z * z);
            this._accelSamples.push(mag);
            this.accelLiveMag = Math.round(mag * 100) / 100;
            this.accelSampleCount = this._accelSamples.length;
            // UI updates driven by the 1-second timer — no notify here
        });

        this._accelTimer = setInterval(() => {
            this.accelElapsed = Math.floor((Date.now() - this.accelStartTime) / 1000);
            this.notify();
        }, 1000);
    }

    stopAccel(): AccelFieldData {
        this._accelSub?.remove(); this._accelSub = null;
        if (this._accelTimer) { clearInterval(this._accelTimer); this._accelTimer = null; }

        const s = this._accelSamples;
        const avg = s.length ? s.reduce((a, b) => a + b, 0) / s.length : 1;
        const rms = s.length ? Math.sqrt(s.reduce((a, b) => a + b * b, 0) / s.length) : 1;
        const peak = s.length ? Math.max(...s) : 1;
        const vibration = Math.abs(rms - 1);
        const category =
            vibration < 0.05 ? "Smooth" :
            vibration < 0.15 ? "Moderate" :
            vibration < 0.30 ? "Rough" : "Very Rough";

        this.accelResult = {
            durationSec: Math.floor((Date.now() - this.accelStartTime) / 1000),
            rms: Math.round(rms * 1000) / 1000,
            peak: Math.round(peak * 1000) / 1000,
            avgMagnitude: Math.round(avg * 1000) / 1000,
            category,
        };
        this.accelStatus = "completed";
        this.notify();
        return this.accelResult;
    }

    cancelAccel() {
        this._accelSub?.remove(); this._accelSub = null;
        if (this._accelTimer) { clearInterval(this._accelTimer); this._accelTimer = null; }
        this.accelStatus = "idle";
        this.accelResult = null;
        this._accelSamples = [];
        this.notify();
    }

    resetAccel() {
        this.cancelAccel();
        this.accelElapsed = 0;
        this.accelLiveMag = 0;
        this.accelSampleCount = 0;
        this.notify();
    }
}

export const trackingStore = new TrackingStore();
