/**
 * Created by drw on 9/26/16.
 * Base de los objetos con física (avatar, proyectiles). Hoy la física del servidor está desactivada.
 */
type PointXY = { X: number; Y: number };

class Physical {
  // `declare`: solo tipos, sin código. Los valores se asignan en el constructor, en el mismo orden que el original
  declare base_gravity: number;
  declare boundPoints: PointXY[];
  declare bounce: number;
  declare boundRadius2: number;
  declare _dt: number;
  declare groundFriction: number;
  declare waterR: number;
  declare totalTime: number;
  declare timeToLive: number;
  declare checkRadius: number;
  declare boundRadius: number;
  declare A: number;
  declare markerColor: number;
  declare windR: number;
  declare Va: number;
  declare gravity: number;
  declare _type: string;
  declare radiansToDegrees: number;
  declare lineNumber: number;
  declare healthPoints: number;
  declare Vx: number;
  declare Vy: number;
  declare X: number;
  declare Y: number;
  declare markerRadius: number;
  declare nChecks: number;
  declare complete: boolean;
  declare rotation: number;

  constructor() {
    this.base_gravity = 0.0005;
    this.boundPoints = [{ X: 0, Y: 0 }];
    this.bounce = 0.001;
    this.boundRadius2 = 625;

    this.dt = 10;
    this.groundFriction = 0.015;
    this.waterR = 0.0012;
    this.totalTime = 0;
    this.timeToLive = -1;
    this.checkRadius = 0; //number
    this.boundRadius = 25;
    this.A = 0;
    this.markerColor = 0xff0000;
    this.windR = 0.0001;
    this.Va = 0;
    this.gravity = this.base_gravity;
    this._type = "unknown";

    this.radiansToDegrees = 57.2957795130823;
    this.lineNumber = 0;
    this.healthPoints = 0;
    this.Vx = 0;
    this.Vy = 0;
    this.X = 0;
    this.Y = 0;

    this.markerRadius = 1;
    this.nChecks = 0;
    this.complete = false;
  }

  get dt(): number {
    return this._dt;
  }

  set dt(value: number) {
    this._dt = value;
  }

  get type(): string {
    return this._type;
  }

  set type(value: string) {
    this._type = value;
  }

  get hp(): number {
    return this.healthPoints;
  }

  set hp(value: number) {
    this.healthPoints = value;
  }

  checkCollision(_X: number, _Y: number): boolean {
    const dX = _X - this.X;
    const dY = _Y - this.Y;
    return dX * dX + dY * dY < this.boundRadius * this.boundRadius;
  }

  onFrame(): void {
    // @ts-expect-error bug: usa A en vez de this.A (ver docs/BUGS.md)
    const newAngle = A * this.radiansToDegrees;
    if (Math.abs(newAngle - this.rotation) > 0.1) {
      this.rotation = newAngle;
    }
  }

  getLinearPoints(X: number, Y: number, A: number, L: number): PointXY[] {
    let i = 0;
    const result: PointXY[] = [];
    let Xi = X;
    let Yi = Y;
    const dX = Math.cos(A);
    const dY = Math.sin(A);

    while (i < L) {
      result.push({ X: Xi, Y: Yi });
      Xi = Xi + dX;
      Yi = Yi + dY;
      i++;
    }
    return result;
  }

  getSemicirclePoints(X: number, Y: number, A: number, R: number): PointXY[] {
    let i = 0;
    let Xi: number;
    let Yi: number;
    const nPoints = Math.abs(parseInt(String(Math.PI * R)));
    const result: PointXY[] = [];
    const dA = 1 / R;
    let angle = A;

    while (i < nPoints) {
      Xi = X + R * Math.cos(angle);
      Yi = Y + R * Math.sin(angle);
      result.push({ X: Xi, Y: Yi });
      angle = angle + dA;
      i++;
    }
    return result;
  }

  getEllipticalPoints(Rx: number, Ry: number): PointXY[] {
    const result: PointXY[] = [];
    let angle = 0;
    while (angle < Math.PI * 2) {
      result.push({ X: Rx * Math.cos(angle), Y: Ry * Math.sin(angle) });
      angle = angle + 1 / Math.sqrt(Rx * Rx + Ry * Ry);
    }
    return result;
  }

  getRectangularPoints(W: number, H: number): PointXY[] {
    let Xi: number;
    let Yi: number;
    const result: PointXY[] = [];
    Xi = -W * 0.5;
    Yi = -H * 0.5;
    while (Yi <= H * 0.5) {
      result.push({ X: Xi, Y: Yi });
      Yi++;
      this.nChecks++;
    }
    Xi = W * 0.5;
    Yi = -H * 0.5;
    while (Yi <= H * 0.5) {
      result.push({ X: Xi, Y: Yi });
      Yi++;
      this.nChecks++;
    }
    Xi = -W * 0.5 + 1;
    Yi = -H * 0.5;
    while (Xi < W * 0.5) {
      result.push({ X: Xi, Y: Yi });
      Xi++;
      this.nChecks++;
    }
    Xi = -W * 0.5 + 1;
    Yi = H * 0.5;
    while (Xi < W * 0.5) {
      result.push({ X: Xi, Y: Yi });
      Xi++;
      this.nChecks++;
    }
    return result;
  }

  getCircularPoints(R: number): PointXY[] {
    const nPoints = Math.PI * R * 2;
    if (nPoints <= 1) {
      return [{ X: 0, Y: 0 }];
    }
    const result: PointXY[] = [];
    const dA = (Math.PI * 2) / nPoints;
    let angle = 0;
    let i = 0;

    while (i < nPoints) {
      result.push({ X: R * Math.cos(angle), Y: R * Math.sin(angle) });
      angle = angle + dA;
      i++;
    }

    return result;
  }
}

export = Physical;
