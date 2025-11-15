// TypeScript generic to make specific keys required in an object
type RequiredBy<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>;

type Entries<T> = {
    [K in keyof T]: [K, T[K]];
}[keyof T][];

declare global {
  interface ObjectConstructor {
    keys<T extends object>(o: T): (keyof T)[]
    entries<T extends object>(o: T): Entries<T>
  }  

  var mapdiv: HTMLElement;
  var ol: any;
  var jQuery: (selector: string) => any;
}

export type TypeDesignationAspect<T> = [shape: T, length: number, wingspan: number];
export type TypeDesignationScaled<T> = [shape: T, scale: number];
export type TypeDesignation<T> = TypeDesignationScaled<T> | TypeDesignationAspect<T>

type SVGPathAttributes = 'd' | 'fill' | 'stroke' | 'stroke-width' | 'stroke-linecap' | 'fill-rule' | 'paint-order';
type SVGPathObject = RequiredBy<Partial<Record<SVGPathAttributes, string | number>>, 'd'>;
type ShapePath = string | SVGPathObject;

export type ShapeSetup = {
    name?: string
    id?: number
    w?: number
    h?: number
    noRotate?: boolean
    viewBox?: string
    // Fixed size relative to a max of 36 x 36px
    fixedSize?: { w: number, h: number }
    // Default size in a 36 x 36px box, used as reference for scaling if no dimensions are available
    defaultSize?: { w: number, h: number }
    path: ShapePath | ShapePath[]
    accent?: ShapePath | ShapePath[]
};

export type Shape = RequiredBy<ShapeSetup, 'name' | 'id' | 'viewBox'>;
export type ShapeScaled = RequiredBy<Shape, 'w' | 'h'>;

type ScaleFactor = 'area' | 'length' | 'wingspan';
type SupportedUrlOptionsBoolean = 'showViewBox' | 'iconTestLabels' | 'iconTypeDesignators' | 'grid' | 'iconTestCols';
type SupportedUrlOptionsString = 'iconTestLabelFilter' | 'scaleBy' | 'scaleFactor';
type SupportedUrlOptionsInt = 'iconSize' | 'iconTestCols' 

interface USP {
    params: URLSearchParams
    has: (key: SupportedUrlOptionsBoolean) => boolean
    get: (key: SupportedUrlOptionsString) => string | null
    getFloat: (key: string) => number | null
    getInt: (key: SupportedUrlOptionsInt) => number | null
}
