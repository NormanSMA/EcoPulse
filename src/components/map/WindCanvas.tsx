"use client";

import { useEffect, useRef } from "react";
import type maplibregl from "maplibre-gl";
import { colors, withAlpha } from "@/design-system/tokens/colors";
import type { WindField } from "@/lib/forecast/field";
import { EARTH_RADIUS_KM, haversineKm, type BBox } from "@/lib/geo";
import { createParticles, particleCountFor, stepParticles, windSpeedScale, type Particle } from "./windParticles";

interface WindParticlesProps {
  map: maplibregl.Map | null;
  field: WindField | null;
  active: boolean;
  projection: "mercator" | "globe";
}

export default function WindParticles({ map, field, active, projection }: WindParticlesProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<{ bbox: BBox; particles: Particle[] } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    if (!map || !field || !active) return;

    const mapCanvas = map.getCanvas();
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const mobile = window.matchMedia("(pointer: coarse)").matches;
    const rng = Math.random;
    let raf: number | null = null;
    let previousTime: number | null = null;
    let moving = map.isMoving();
    let dpr = 1;
    let particles: Particle[] = [];

    const pause = () => {
      if (raf !== null) cancelAnimationFrame(raf);
      raf = null;
      previousTime = null;
      context.clearRect(0, 0, canvas.width, canvas.height);
    };

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(mapCanvas.clientWidth * dpr);
      canvas.height = Math.round(mapCanvas.clientHeight * dpr);
      const count = particleCountFor(mapCanvas.clientWidth * mapCanvas.clientHeight, mobile);
      const previous = particlesRef.current;
      const sameBbox = previous?.bbox.every((value, index) => value === field.bbox[index]);
      particles = previous && sameBbox && previous.particles.length === count
        ? previous.particles
        : createParticles(count, field.bbox, rng);
      particlesRef.current = { bbox: [...field.bbox], particles };
      previousTime = null;
    };

    const draw = (time: number) => {
      raf = null;
      if (moving || motion.matches || document.hidden) {
        pause();
        return;
      }
      const dt = previousTime === null ? 0 : Math.min(0.05, (time - previousTime) / 1000);
      previousTime = time;
      context.globalCompositeOperation = "destination-out";
      context.fillStyle = withAlpha(colors.palette.white, 0.05);
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.globalCompositeOperation = "source-over";
      context.strokeStyle = withAlpha(colors.palette.white, 0.9);
      context.lineWidth = 1.6 * dpr;
      const previous = particles.map(({ lon, lat }) => [lon, lat] as [number, number]);
      stepParticles(particles, field, dt, field.bbox, rng, windSpeedScale(map.getZoom()));
      const center = map.getCenter().toArray();
      const horizonKm = EARTH_RADIUS_KM * (80 * Math.PI / 180);
      context.beginPath();
      for (let index = 0; index < particles.length; index++) {
        const particle = particles[index];
        if (particle.age === 0) continue;
        const next: [number, number] = [particle.lon, particle.lat];
        if (projection === "globe" && (
          haversineKm(center, previous[index]) > horizonKm || haversineKm(center, next) > horizonKm
        )) continue;
        const from = map.project(previous[index]);
        const to = map.project(next);
        if (!Number.isFinite(from.x + from.y + to.x + to.y)) continue;
        context.moveTo(from.x * dpr, from.y * dpr);
        context.lineTo(to.x * dpr, to.y * dpr);
      }
      context.stroke();
      raf = requestAnimationFrame(draw);
    };

    const resume = () => {
      if (moving || motion.matches || document.hidden) {
        pause();
        return;
      }
      if (raf === null) raf = requestAnimationFrame(draw);
    };
    const onMoveStart = () => {
      moving = true;
      pause();
    };
    const onMoveEnd = () => {
      moving = map.isMoving();
      resume();
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(mapCanvas);
    map.on("movestart", onMoveStart);
    map.on("zoomstart", onMoveStart);
    map.on("moveend", onMoveEnd);
    document.addEventListener("visibilitychange", resume);
    motion.addEventListener("change", resume);
    resume();

    return () => {
      pause();
      observer.disconnect();
      map.off("movestart", onMoveStart);
      map.off("zoomstart", onMoveStart);
      map.off("moveend", onMoveEnd);
      document.removeEventListener("visibilitychange", resume);
      motion.removeEventListener("change", resume);
    };
  }, [map, field, active, projection]);

  return <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full" />;
}
