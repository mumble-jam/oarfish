// Procedural swimming for the oarfish rig.
// The head is steered; every spine bone then follows the trail the head left behind,
// with a travelling wave on top whose size and tempo depend on speed.
// The rig can be re-attached to a rebuilt model with a different number of spine bones.

import * as THREE from 'three';
import { lerp, clamp, damp } from './geo.js';

const UP = new THREE.Vector3(0, 1, 0);
const DS = 0.06; // spacing of trail samples, metres
const TRAIL_POINTS = 170; // enough for the longest body
const wrapPi = (a) => {
  a = (a + Math.PI) % (Math.PI * 2);
  if (a < 0) a += Math.PI * 2;
  return a - Math.PI;
};

export const SPEED = { idle: 0.22, swim: 3.3, sprint: 6.4, coil: 1.45, dash: 13 };
export const DASH_TIME = 0.2; // seconds at dash speed; the lunge covers about three and a half metres in all
export const SNOUT = 0.45; // metres from the neck to the tip of the nose

const _x = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3(), _ax = new THREE.Vector3();
const _m = new THREE.Matrix4();
// orientation whose +Z looks along `forward`, kept upright, then rolled around it
function frame(forward, roll, out) {
  _z.copy(forward).normalize();
  _x.crossVectors(UP, _z);
  if (_x.lengthSq() < 1e-6) _x.set(1, 0, 0);
  _x.normalize();
  _y.crossVectors(_z, _x);
  if (roll) {
    const c = Math.cos(roll), s = Math.sin(roll);
    _ax.copy(_x);
    _x.multiplyScalar(c).addScaledVector(_y, s);
    _y.multiplyScalar(c).addScaledVector(_ax, -s);
  }
  return out.setFromRotationMatrix(_m.makeBasis(_x, _y, _z));
}

export class OarfishRig {
  constructor() {
    this.pos = new THREE.Vector3();
    this.forward = new THREE.Vector3(0, 0, 1);
    this.snout = new THREE.Vector3();
    this.joints = [];
    this.trail = [];
    this.filaments = null;
    this.spine = [];
    this.yaw = 0; this.pitch = 0; this.roll = 0; this.yawRate = 0;
    this.speed = SPEED.idle; this.phase = 0; this.time = 0;
    this.headYaw = 0; this.gape = 0; this.boost = 0; this.coiling = 0; this.dashT = 0;
    this._h = new THREE.Quaternion(); this._w0 = new THREE.Quaternion();
    this._e = new THREE.Euler(0, 0, 0, 'YXZ');
    this._a = { p: new THREE.Vector3(), roll: 0 }; this._b = { p: new THREE.Vector3(), roll: 0 };
    this._wrap = { angle: 0, sign: 1, start: 0, k: 0, minD: 0 };
  }

  // bind to a (re)built model; position, heading and trail carry over
  attach(model) {
    const bone = (n) => {
      const b = model.getObjectByName(n);
      if (!b) throw new Error(`The model is missing the bone "${n}".`);
      return b;
    };
    this.root = bone('root'); this.head = bone('head'); this.jaw = bone('jaw');
    this.spine = [];
    for (let k = 1; ; k++) {
      const b = model.getObjectByName(`spine_${String(k).padStart(2, '0')}`);
      if (!b) break;
      this.spine.push(b);
    }
    const N = this.spine.length;
    this.seg = this.spine.slice(1).map((b) => Math.abs(b.position.z));
    this.seg.push(this.seg[N - 2]);
    this.cum = [0];
    for (let k = 0; k < N; k++) this.cum.push(this.cum[k] + this.seg[k]);
    this.length = this.cum[N];
    const old = this.joints;
    this.joints = Array.from({ length: N + 1 }, (_, i) => old[i] || (old.length ? old[old.length - 1].clone() : new THREE.Vector3()));
    this._targets = Array.from({ length: N + 1 }, () => ({ p: new THREE.Vector3(), roll: 0 }));

    this.pectoral = [{ bone: bone('pectoral_L'), side: 1 }, { bone: bone('pectoral_R'), side: -1 }];
    // the two long pelvic filaments: rest joints in the frame of the first spine bone
    const prev = this.filaments;
    this.filaments = ['L', 'R'].map((s, si) => {
      const bones = [1, 2, 3, 4].map((i) => bone(`pelvic_${s}_0${i}`));
      const rest = [bones[0].position.clone()];
      for (let i = 1; i < 4; i++) rest.push(rest[i - 1].clone().add(bones[i].position));
      rest.push(rest[3].clone().add(rest[3]).sub(rest[2])); // tip, extrapolated
      const dirs = [], lens = [];
      for (let i = 0; i < 4; i++) {
        const d = rest[i + 1].clone().sub(rest[i]);
        lens.push(d.length());
        dirs.push(d.normalize());
      }
      return { bones, rest, dirs, lens, joints: prev ? prev[si].joints : rest.map((p) => p.clone()), side: si === 0 ? 1 : -1 };
    });
    if (prev && this.trail.length) this._pose(1e-3, this._world); // never show the new bones un-posed
  }

  reset(pos, yaw, pitch = 0) {
    this.pos.copy(pos);
    this.yaw = yaw; this.pitch = pitch; this.roll = 0; this.yawRate = 0; this.speed = SPEED.idle; this.boost = 0; this.dashT = 0;
    this.forward.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
    this.snout.copy(this.pos).addScaledVector(this.forward, SNOUT);
    this.trail = [];
    for (let i = 1; i <= TRAIL_POINTS; i++) this.trail.push({ p: pos.clone().addScaledVector(this.forward, -i * DS), roll: 0 });
    this._pose(0);
    for (const f of this.filaments) f.joints.forEach((j, i) => j.copy(f.rest[i]).applyQuaternion(this._w0).add(this.pos));
    this._pose(1e-3, this._world);
  }

  // point on the head's trail, `s` metres behind the neck
  _sample(s, out) {
    const tr = this.trail, d0 = this.pos.distanceTo(tr[0].p);
    if (s <= d0) {
      const t = d0 > 1e-6 ? s / d0 : 0;
      out.p.lerpVectors(this.pos, tr[0].p, t);
      out.roll = lerp(this.roll, tr[0].roll, t);
      return out;
    }
    const j = (s - d0) / DS, i = Math.min(Math.floor(j), tr.length - 2), f = Math.min(j - i, 1);
    out.p.lerpVectors(tr[i].p, tr[i + 1].p, f);
    out.roll = lerp(tr[i].roll, tr[i + 1].roll, f);
    return out;
  }

  // input: { dir: Vector3 | null (unit, horizontal), amount: 0..1, vertical: -1..1, sprint, winded, dash, gentle, coil: -1 | 0 | 1, tight }
  // dash is true on the one frame a dash starts; winded means sprint is asked for but there is nothing left to pay for it
  // coil swims the widest circle the body can close (the nose just reaching the tail); tight winds it into a spiral
  // world: { height(x, z), pushOut(pos, radius), ceiling }
  update(dt, input, world) {
    this._world = world;
    this.time += dt;
    this.boost = Math.max(0, this.boost - dt);
    const coil = input.coil || 0;
    const moving = !!input.dir && !coil;
    let dYaw = 0;
    if (moving) dYaw = wrapPi(Math.atan2(input.dir.x, input.dir.z) - this.yaw);
    if (input.dash && !coil) { // a lunge the way the head points, bent a little toward where the player steers
      this.dashT = DASH_TIME * (input.dashScale || 1);
      this.yaw = wrapPi(this.yaw + clamp(dYaw, -0.8, 0.8)); dYaw = wrapPi(dYaw - clamp(dYaw, -0.8, 0.8));
    }
    const dashing = this.dashT > 0;
    this.dashT = Math.max(0, this.dashT - dt);

    let target = SPEED.idle;
    const coilR = input.tight ? 0.42 : input.coilR || (this.length + 0.8) / (Math.PI * 2);
    if (coil) target = input.tight ? SPEED.coil : clamp(SPEED.coil + 0.25 * (this.length - 3), SPEED.coil, 2.8);
    else if (moving) target = lerp(input.gentle ? SPEED.idle * 1.6 : SPEED.swim * 0.45, input.sprint && !input.winded ? SPEED.sprint : SPEED.swim, clamp(input.amount ?? 1, 0, 1));
    else if (input.vertical) target = SPEED.swim * 0.55;
    target *= 1 - 0.5 * clamp(Math.abs(dYaw) / 2.2, 0, 1); // ease off in hard turns, which is what lets it coil
    if (this.boost > 0) target = Math.max(target, SPEED.sprint * 1.1);
    if (dashing) this.speed = SPEED.dash;
    else this.speed = damp(this.speed, target, target > this.speed ? 2.4 : this.speed > SPEED.sprint * 1.15 ? 7 : 1.4, dt); // the speed of a dash bleeds off fast
    const sn = clamp(this.speed / SPEED.sprint, 0, 1);

    const maxTurn = lerp(3.5, 3.0, clamp(this.speed / SPEED.swim, 0, 1));
    const wantRate = coil ? coil * clamp(Math.max(this.speed, 0.6) / coilR, 0.4, 3.6) : clamp(dYaw * 3.4, -maxTurn, maxTurn) * (dashing ? 0.35 : 1); // a dash is committed
    this.yawRate = damp(this.yawRate, wantRate, 8, dt);
    this.yaw = wrapPi(this.yaw + this.yawRate * dt);
    this.coiling = damp(this.coiling, coil || Math.abs(this.yawRate) > 2 ? 1 : 0, 2.5, dt);

    // climb and dive; stay clear of the seabed and the ceiling
    let wantPitch = (input.vertical || 0) * 0.62;
    const ground = world.height(this.pos.x, this.pos.z);
    const alt = this.pos.y - ground;
    if (alt < 1.5) wantPitch = Math.max(wantPitch, (1.5 - alt) * 0.45);
    if (this.pos.y > world.ceiling - 1.5) wantPitch = Math.min(wantPitch, (world.ceiling - 1.5 - this.pos.y) * 0.45);
    this.pitch = damp(this.pitch, wantPitch, 3.2, dt);
    this.roll = damp(this.roll, clamp(-this.yawRate * 0.16, -0.5, 0.5), 5, dt);

    this.forward.set(Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch));
    this.pos.addScaledVector(this.forward, this.speed * dt);
    world.pushOut(this.pos, 0.42);
    const floor = world.height(this.pos.x, this.pos.z) + 0.7;
    if (this.pos.y < floor) this.pos.y = floor;
    if (this.pos.y > world.ceiling) this.pos.y = world.ceiling;
    this.snout.copy(this.pos).addScaledVector(this.forward, SNOUT);

    // lay down trail
    const tr = this.trail, step = _ax;
    for (let guard = 0; guard < 60; guard++) {
      step.subVectors(this.pos, tr[0].p);
      const d = step.length();
      if (d < DS) break;
      const last = tr.pop();
      last.p.copy(tr[0].p).addScaledVector(step, DS / d);
      last.roll = this.roll;
      tr.unshift(last);
    }

    this.phase += dt * Math.PI * 2 * lerp(0.38, 1.55, sn);
    this.headYaw = damp(this.headYaw, clamp(dYaw * 0.4, -0.4, 0.4), 6, dt);
    this.gape = damp(this.gape, (input.sprint && !input.winded && moving) || input.bite || dashing ? 0.3 : 0.04, dashing ? 20 : 5, dt);
    this._pose(dt, world);
  }

  _pose(dt, world) {
    const N = this.spine.length;
    const sn = clamp(this.speed / SPEED.sprint, 0, 1);
    const ampTail = (0.1 + 0.25 * Math.pow(sn, 0.7)) * (1 - 0.6 * this.coiling); // calmer while coiled, so loops close cleanly
    const KAPPA = (Math.PI * 2) / 3.3; // one wave every 3.3 m of body

    const H = this._h;
    frame(this.forward, this.roll, H);
    this.root.position.copy(this.pos);
    this.root.quaternion.copy(H);

    // where each joint wants to be
    const a = this._a, b = this._b, targets = this._targets;
    const tan = new THREE.Vector3(), side = new THREE.Vector3();
    for (let k = 0; k <= N; k++) {
      const s = this.cum[k], t = targets[k];
      this._sample(s, t);
      if (k === 0) continue;
      this._sample(Math.max(s - 0.15, 0), a);
      this._sample(s + 0.15, b);
      tan.subVectors(a.p, b.p);
      side.crossVectors(UP, tan);
      if (side.lengthSq() < 1e-8) continue;
      side.normalize();
      const amp = ampTail * Math.pow(Math.min(s / 4.4, 1), 1.25);
      t.p.addScaledVector(side, amp * Math.sin(this.phase - KAPPA * s));
    }

    // aim each bone at the next target from where the chain actually is
    const prev = new THREE.Quaternion().copy(H), w = new THREE.Quaternion(), inv = new THREE.Quaternion();
    const at = new THREE.Vector3().copy(this.pos), d = new THREE.Vector3(), nd = new THREE.Vector3();
    this.joints[0].copy(at);
    for (let k = 0; k < N; k++) {
      d.subVectors(targets[k + 1].p, at);
      if (d.lengthSq() < 1e-10) d.copy(this.forward).negate();
      d.normalize();
      frame(nd.copy(d).negate(), (targets[k].roll + targets[k + 1].roll) / 2, w);
      this.spine[k].quaternion.copy(inv.copy(prev).invert()).multiply(w);
      if (k === 0) this._w0.copy(w);
      at.addScaledVector(d, this.seg[k]);
      this.joints[k + 1].copy(at);
      prev.copy(w);
    }

    // head leads into the turn and nods a little against the tail beat
    const e = this._e;
    this.head.quaternion.setFromEuler(e.set(0, this.headYaw + 0.035 * (0.4 + sn) * Math.sin(this.phase + 0.7), 0));
    this.jaw.quaternion.setFromEuler(e.set(this.gape + 0.025 * Math.sin(this.time * 1.7), 0, 0));
    for (const f of this.pectoral) {
      const open = 0.45 + 0.35 * Math.sin(this.time * 2.3 + (f.side > 0 ? 0 : 1.4)) + clamp(-this.yawRate * f.side * 0.3, -0.3, 0.5);
      f.bone.quaternion.setFromEuler(e.set(0, f.side * (0.12 - 0.5 * clamp(open, 0, 1.2)), 0));
    }

    // pelvic filaments: dragged through the water behind their attachment point
    if (!dt) return;
    const w0 = this._w0, w0inv = inv.copy(w0).invert();
    const tgt = new THREE.Vector3(), dir = new THREE.Vector3(), local = new THREE.Vector3();
    const q = new THREE.Quaternion(), qPrev = new THREE.Quaternion();
    for (const f of this.filaments) {
      f.joints[0].copy(f.rest[0]).applyQuaternion(w0).add(this.pos);
      for (let i = 1; i <= 4; i++) {
        const j = f.joints[i];
        tgt.copy(f.rest[i]).applyQuaternion(w0).add(this.pos);
        tgt.y += 0.05 * Math.sin(this.time * 1.3 + i * 0.9 + f.side);
        j.lerp(tgt, 1 - Math.exp(-(1.1 + 0.25 * i) * dt));
        if (world) j.y = Math.max(j.y, world.height(j.x, j.z) + 0.08);
        dir.subVectors(j, f.joints[i - 1]);
        if (dir.lengthSq() < 1e-10) dir.copy(f.dirs[i - 1]).applyQuaternion(w0);
        j.copy(f.joints[i - 1]).addScaledVector(dir.normalize(), f.lens[i - 1]);
      }
      qPrev.identity();
      for (let i = 0; i < 4; i++) {
        local.subVectors(f.joints[i + 1], f.joints[i]).normalize().applyQuaternion(w0inv);
        q.setFromUnitVectors(f.dirs[i], local);
        f.bones[i].quaternion.copy(qPrev).invert().multiply(q);
        qPrev.copy(q);
      }
    }
  }

  // How far round the point (cx, cz) the body goes, measured from the nose back along the body.
  // Fills { angle (radians swept), sign (which way), start (bearing of the nose), k (joints used), minD (closest approach) }.
  wrap(cx, cy, cz, far) {
    const J = this.joints, N = J.length - 1, S = this.snout, out = this._wrap;
    let prev = Math.atan2(S.x - cx, S.z - cz), cum = 0, minD = Math.hypot(S.x - cx, S.z - cz);
    out.angle = 0; out.sign = 1; out.start = prev; out.k = 0; out.minD = minD;
    for (let i = 0; i <= N; i++) {
      const p = J[i], d = Math.hypot(p.x - cx, p.z - cz);
      if (d > far || Math.abs(p.y - cy) > 1.8) break;
      const a = Math.atan2(p.x - cx, p.z - cz);
      cum += wrapPi(a - prev); prev = a;
      if (d < minD) minD = d;
      if (Math.abs(cum) > out.angle) { out.angle = Math.abs(cum); out.sign = cum < 0 ? -1 : 1; out.k = i; out.minD = minD; }
    }
    return out;
  }
}
