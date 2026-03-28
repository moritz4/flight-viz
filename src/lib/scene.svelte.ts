import * as THREE from "three";
import type { FlightsData } from "./data";
import { linear } from "everpolate";

const TRAILLENGTH = 40; // approximate trail length in minutes
const LINEDETAIL = 30; // integer only

// Colours for airports RGBA
const AIRPORT_COLOURS = {
  LHR: 0x80f4ffff,
  LGW: 0xc3ffa8ff,
  MAN: 0xffff00ff,
  STN: 0x8080ffff,
  LTN: 0x80ff80ff,
  EDI: 0xff8080ff,
  BHX: 0x1fffffff,
  BRS: 0xff1fffff,
  GLA: 0xffff1fff,
  BFS: 0x1010ffff,
  NCL: 0x10ff10ff,
  LPL: 0xff4c4cff,
  LBA: 0xff4cff,
  EMA: 0xffff4cff,
  LCY: 0x4cffffff,
};

// Class to store data and curves for each flight
class Flight {
  origin: string;
  dest: string;
  startTime: number;
  endTime: number;
  positions: { time: number; x: number; y: number; z: number }[];
  color: number;
  curve: THREE.CatmullRomCurve3;
  curveObject: THREE.Line;
  dot: THREE.Points;

  constructor(
    origin: string,
    dest: string,
    startTime: number,
    endTime: number,
    positions: { time: number; x: number; y: number; z: number }[],
  ) {
    if (positions.length < 2) {
      throw new Error("Flight must have at least 2 positions");
    }
    this.origin = origin;
    this.dest = dest;
    this.startTime = startTime;
    this.endTime = endTime;
    this.positions = positions;
    this.color =
      AIRPORT_COLOURS[dest as keyof typeof AIRPORT_COLOURS] || 0xffffff;

    // Create curve
    const points = [];

    for (const position of positions) {
      points.push(new THREE.Vector3(position.x, position.z, position.y)); // note the swap of y and z to match three.js coordinate system
    }

    this.curve = new THREE.CatmullRomCurve3(points);

    const curvePoints = this.curve.getPoints(points.length * LINEDETAIL - 1);
    const geometry = new THREE.BufferGeometry().setFromPoints(curvePoints);

    // ADD COLOR ATTRIBUTE with alpha channel
    const numPoints = curvePoints.length;
    const colors = new Float32Array(numPoints * 4); // RGBA
    const color = new THREE.Color(this.color);

    for (let i = 0; i < numPoints; i++) {
      colors[i * 4] = color.r; // R
      colors[i * 4 + 1] = color.g; // G
      colors[i * 4 + 2] = color.b; // B
      colors[i * 4 + 3] = 1.0; // A (alpha)
    }

    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 4));

    // Update material to use vertex colors with transparency
    const material = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
    });

    this.curveObject = new THREE.Line(geometry, material);
    this.curveObject.visible = false;

    // SECOND, create dot to represent the plane
    const startingPosition = this.positions[0];

    const dotGeometry = new THREE.BufferGeometry();
    dotGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(
        new Float32Array([
          startingPosition.x,
          startingPosition.z,
          startingPosition.y,
        ]),
        3,
      ),
    );

    const dotMaterial = new THREE.PointsMaterial({
      size: 4,
      color: new THREE.Color(this.color),
      transparent: true,
      opacity: 1,
    });

    const dot = new THREE.Points(dotGeometry, dotMaterial);

    // Add to object
    this.dot = dot;
    this.dot.visible = false;
  }

  // function that returns the position t along the curve at a given time
  getT(time: number) {
    if (
      time < this.positions[0].time ||
      time > this.positions[this.positions.length - 1].time
    ) {
      return null;
    }

    function linspace(
      start: number,
      stop: number,
      num: number,
      endpoint = true,
    ) {
      const div = endpoint ? num - 1 : num;
      const step = (stop - start) / div;
      return Array.from({ length: num }, (_, i) => start + step * i);
    }

    const t = linear(
      time,
      this.positions.map((position) => position.time),
      linspace(0, 1, this.positions.length),
    );

    return t;
  }

  // function to move point to right position
  drawPoint(t: number) {
    const position = this.curve.getPoint(t);

    //  Update the existing array values directly
    const positionArray = this.dot.geometry.attributes.position
      .array as Float32Array;
    positionArray[0] = position.x;
    positionArray[1] = position.y;
    positionArray[2] = position.z;

    this.dot.geometry.attributes.position.needsUpdate = true;
    this.dot.geometry.computeBoundingSphere();
  }

  drawLine(t: number, currentTime: number) {
    let endIndex;
    let startIndex;
    let count;

    if (t != null) {
      // Current position
      const currentPosition = this.curve.getPoint(t);
      endIndex = Math.floor((this.positions.length * LINEDETAIL - 1) * t);

      // Calculate trail start
      const trailStartTime = currentTime - TRAILLENGTH * 60;
      const tTrailStart = this.getT(trailStartTime);

      if (tTrailStart !== null) {
        startIndex = Math.floor(
          (this.positions.length * LINEDETAIL - 1) * tTrailStart,
        );
      } else {
        startIndex = 0;
      }

      // Update the start of the curve to match current position
      const curvePositions = this.curveObject.geometry.attributes.position
        .array as Float32Array;
      curvePositions[endIndex * 3] = currentPosition.x;
      curvePositions[endIndex * 3 + 1] = currentPosition.y;
      curvePositions[endIndex * 3 + 2] = currentPosition.z;

      this.curveObject.geometry.attributes.position.needsUpdate = true;

      count = endIndex - startIndex + 1;
    } else {
      // If the plane is on the ground, get the index of the position that the plane was at 10 minutes ago
      const t = this.getT(currentTime - TRAILLENGTH * 60);
      startIndex = Math.floor((this.positions.length * LINEDETAIL - 1) * t);
      // Approximate what the end index would be in the plane was still in the air.
      // We know that positions are recorded approximately every minute
      endIndex = startIndex + Math.floor(LINEDETAIL * TRAILLENGTH);
      count = Infinity;
    }

    this.curveObject.geometry.setDrawRange(startIndex, count);

    // Update alpha values
    const colorArray = this.curveObject.geometry.attributes.color
      .array as Float32Array;
    const totalPoints = this.positions.length * LINEDETAIL;

    for (let i = 0; i < totalPoints; i++) {
      let alpha;
      if (i < startIndex || i > endIndex) {
        alpha = 0;
      } else {
        alpha = (i - startIndex) / (endIndex - startIndex);
      }
      colorArray[i * 4 + 3] = Math.max(0, Math.min(1, alpha));
    }

    this.curveObject.geometry.attributes.color.needsUpdate = true;
  }
}

export class Timer {
  startTime: number = $state(0);
  endTime: number = $state(0);
  currentTime: number = $state(0);
  playing = $state(false);
  clock: THREE.Clock;
  speed: number = $state(1000);

  constructor(start: number, end: number) {
    // Start the timer at the first flight's departure time
    this.startTime = start; // add 60s buffer at the start to allow some planes to already be in the air at the start of the timer
    this.endTime = end;
    this.currentTime = start;
    this.clock = new THREE.Clock();
  }

  tick() {
    const delta = this.clock.getDelta();
    if (!this.playing) return;

    // Advance the clock
    this.currentTime += delta * this.speed;
    if (this.currentTime >= this.endTime) {
      this.currentTime = this.endTime;
    }
  }
}

export const flights: Flight[] = [];

// Function to be run once to initialise the scene
export function initScene(scene: THREE.Scene, data: FlightsData) {
  // Add ambient light
  const ambientLight = new THREE.AmbientLight(0xffffff, 1);
  scene.add(ambientLight);
  // Create flight objects
  Object.values(data).forEach((flight) => {
    try {
      const x = new Flight(
        flight.origin,
        flight.dest,
        flight.positions[0][0], // start time
        flight.positions[flight.positions.length - 1][0], // end time
        flight.positions.map((position) => ({
          time: position[0],
          x: position[1],
          y: position[2],
          z: position[3],
        })),
      );
      flights.push(x);
    } catch (e) {
      console.error("Error creating flight:", e);
    }
  });

  flights.forEach((flight) => {
    scene.add(flight.curveObject);
    scene.add(flight.dot);
  });

  return scene;
}

// Run every frame to update the scene
export function renderLoop(scene: THREE.Scene, timer: Timer) {
  // Loop through flights and update visibility based on current time
  flights.forEach((flight) => {
    // Get the position along the curve at the current time
    const t = flight.getT(timer.currentTime);

    // If the plane is in the air, show the dot and animate it
    if (t != null) {
      flight.dot.visible = true;
      flight.drawPoint(t);
    } else {
      flight.dot.visible = false;
    }

    // Check if the line should be drawn
    if (
      timer.currentTime > flight.startTime &&
      timer.currentTime < flight.endTime + TRAILLENGTH * 60
    ) {
      flight.curveObject.visible = true;
      flight.drawLine(t, timer.currentTime);
    } else {
      flight.curveObject.visible = false;
    }
  });
  timer.tick();
}
