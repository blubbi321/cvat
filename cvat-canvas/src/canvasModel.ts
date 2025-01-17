/*
* Copyright (C) 2019 Intel Corporation
* SPDX-License-Identifier: MIT
*/

// Disable till full implementation
/* eslint class-methods-use-this: "off" */

import { MasterImpl } from './master';

export interface Size {
    width: number;
    height: number;
}

export interface Position {
    x: number;
    y: number;
}

export interface Geometry {
    image: Size;
    canvas: Size;
    grid: Size;
    top: number;
    left: number;
    scale: number;
    offset: number;
    angle: number;
}

export interface FocusData {
    clientID: number;
    padding: number;
}

export interface ActiveElement {
    clientID: number;
    attributeID: number;
}

export interface DrawData {
    enabled: boolean;
    shapeType?: string;
    numberOfPoints?: number;
    initialState?: any;
    crosshair?: boolean;
}

export enum FrameZoom {
    MIN = 0.1,
    MAX = 10,
}

export enum Rotation {
    ANTICLOCKWISE90,
    CLOCKWISE90,
}

export enum UpdateReasons {
    IMAGE = 'image',
    OBJECTS = 'objects',
    ZOOM = 'zoom',
    FIT = 'fit',
    MOVE = 'move',
    GRID = 'grid',
    FOCUS = 'focus',
    ACTIVATE = 'activate',
    DRAW = 'draw',
}

export interface CanvasModel extends MasterImpl {
    readonly image: string;
    readonly objects: any[];
    readonly gridSize: Size;
    readonly focusData: FocusData;
    readonly activeElement: ActiveElement;
    readonly objectStateClass: any;
    readonly drawData: DrawData;
    geometry: Geometry;

    zoom(x: number, y: number, direction: number): void;
    move(topOffset: number, leftOffset: number): void;

    setup(frameData: any, objectStates: any[]): void;
    activate(clientID: number, attributeID: number): void;
    rotate(rotation: Rotation, remember: boolean): void;
    focus(clientID: number, padding: number): void;
    fit(): void;
    grid(stepX: number, stepY: number): void;

    draw(drawData: DrawData): void;
    split(enabled: boolean): void;
    group(enabled: boolean): void;
    merge(enabled: boolean): void;

    cancel(): void;
}

export class CanvasModelImpl extends MasterImpl implements CanvasModel {
    private data: {
        ObjectStateClass: any;
        activeElement: ActiveElement;
        angle: number;
        canvasSize: Size;
        drawData: DrawData;
        image: string;
        imageOffset: number;
        imageSize: Size;
        focusData: FocusData;
        gridSize: Size;
        left: number;
        objects: any[];
        rememberAngle: boolean;
        scale: number;
        top: number;
    };

    public constructor(ObjectStateClass: any) {
        super();

        this.data = {
            activeElement: {
                clientID: null,
                attributeID: null,
            },
            angle: 0,
            canvasSize: {
                height: 0,
                width: 0,
            },
            drawData: {
                enabled: false,
                shapeType: null,
                numberOfPoints: null,
                initialState: null,
            },
            image: '',
            imageOffset: 0,
            imageSize: {
                height: 0,
                width: 0,
            },
            focusData: {
                clientID: 0,
                padding: 0,
            },
            gridSize: {
                height: 100,
                width: 100,
            },
            left: 0,
            objects: [],
            ObjectStateClass,
            rememberAngle: false,
            scale: 1,
            top: 0,
        };
    }

    public zoom(x: number, y: number, direction: number): void {
        const oldScale: number = this.data.scale;
        const newScale: number = direction > 0 ? oldScale * 6 / 5 : oldScale * 5 / 6;
        this.data.scale = Math.min(Math.max(newScale, FrameZoom.MIN), FrameZoom.MAX);

        const { angle } = this.data;

        const mutiplier = Math.sin(angle * Math.PI / 180) + Math.cos(angle * Math.PI / 180);
        if ((angle / 90) % 2) {
            // 90, 270, ..
            this.data.top += mutiplier * ((x - this.data.imageSize.width / 2)
                * (oldScale / this.data.scale - 1)) * this.data.scale;
            this.data.left -= mutiplier * ((y - this.data.imageSize.height / 2)
                * (oldScale / this.data.scale - 1)) * this.data.scale;
        } else {
            this.data.left += mutiplier * ((x - this.data.imageSize.width / 2)
                * (oldScale / this.data.scale - 1)) * this.data.scale;
            this.data.top += mutiplier * ((y - this.data.imageSize.height / 2)
                * (oldScale / this.data.scale - 1)) * this.data.scale;
        }

        this.notify(UpdateReasons.ZOOM);
    }

    public move(topOffset: number, leftOffset: number): void {
        this.data.top += topOffset;
        this.data.left += leftOffset;
        this.notify(UpdateReasons.MOVE);
    }

    public setup(frameData: any, objectStates: any[]): void {
        frameData.data(
            (): void => {
                this.data.image = '';
                this.notify(UpdateReasons.IMAGE);
            },
        ).then((data: string): void => {
            this.data.imageSize = {
                height: (frameData.height as number),
                width: (frameData.width as number),
            };

            if (!this.data.rememberAngle) {
                this.data.angle = 0;
            }

            this.data.image = data;
            this.notify(UpdateReasons.IMAGE);
            this.data.objects = objectStates;
            this.notify(UpdateReasons.OBJECTS);
        }).catch((exception: any): void => {
            console.log(exception.toString());
        });

        console.log(objectStates);
    }

    public activate(clientID: number, attributeID: number): void {
        this.data.activeElement = {
            clientID,
            attributeID,
        };

        this.notify(UpdateReasons.ACTIVATE);
    }

    public rotate(rotation: Rotation, remember: boolean = false): void {
        if (rotation === Rotation.CLOCKWISE90) {
            this.data.angle += 90;
        } else {
            this.data.angle -= 90;
        }

        this.data.angle %= 360;
        this.data.rememberAngle = remember;
        this.fit();
    }

    public focus(clientID: number, padding: number): void {
        this.data.focusData = {
            clientID,
            padding,
        };

        this.notify(UpdateReasons.FOCUS);
    }

    public fit(): void {
        const { angle } = this.data;

        if ((angle / 90) % 2) {
            // 90, 270, ..
            this.data.scale = Math.min(
                this.data.canvasSize.width / this.data.imageSize.height,
                this.data.canvasSize.height / this.data.imageSize.width,
            );
        } else {
            this.data.scale = Math.min(
                this.data.canvasSize.width / this.data.imageSize.width,
                this.data.canvasSize.height / this.data.imageSize.height,
            );
        }

        this.data.scale = Math.min(
            Math.max(this.data.scale, FrameZoom.MIN),
            FrameZoom.MAX,
        );

        this.data.top = (this.data.canvasSize.height / 2 - this.data.imageSize.height / 2);
        this.data.left = (this.data.canvasSize.width / 2 - this.data.imageSize.width / 2);

        this.notify(UpdateReasons.FIT);
    }

    public grid(stepX: number, stepY: number): void {
        this.data.gridSize = {
            height: stepY,
            width: stepX,
        };

        this.notify(UpdateReasons.GRID);
    }

    public draw(drawData: DrawData): void {
        if (drawData.enabled) {
            if (this.data.drawData.enabled) {
                throw new Error('Drawing has been already started');
            } else if (!drawData.shapeType) {
                throw new Error('A shape type is not specified');
            } else if (typeof (drawData.numberOfPoints) !== 'undefined') {
                if (drawData.shapeType === 'polygon' && drawData.numberOfPoints < 3) {
                    throw new Error('A polygon consists of at least 3 points');
                } else if (drawData.shapeType === 'polyline' && drawData.numberOfPoints < 2) {
                    throw new Error('A polyline consists of at least 2 points');
                }
            }
        }

        this.data.drawData = Object.assign({}, drawData);
        this.notify(UpdateReasons.DRAW);
    }

    public split(enabled: boolean): any {
        return enabled;
    }

    public group(enabled: boolean): any {
        return enabled;
    }

    public merge(enabled: boolean): any {
        return enabled;
    }

    public cancel(): void {
        console.log('hello');
    }

    public get geometry(): Geometry {
        return {
            angle: this.data.angle,
            canvas: Object.assign({}, this.data.canvasSize),
            image: Object.assign({}, this.data.imageSize),
            grid: Object.assign({}, this.data.gridSize),
            left: this.data.left,
            offset: this.data.imageOffset,
            scale: this.data.scale,
            top: this.data.top,
        };
    }

    public set geometry(geometry: Geometry) {
        this.data.angle = geometry.angle;
        this.data.canvasSize = Object.assign({}, geometry.canvas);
        this.data.imageSize = Object.assign({}, geometry.image);
        this.data.gridSize = Object.assign({}, geometry.grid);
        this.data.left = geometry.left;
        this.data.top = geometry.top;
        this.data.imageOffset = geometry.offset;
        this.data.scale = geometry.scale;

        this.data.imageOffset = Math.floor(Math.max(
            this.data.canvasSize.height / FrameZoom.MIN,
            this.data.canvasSize.width / FrameZoom.MIN,
        ));
    }

    public get image(): string {
        return this.data.image;
    }

    public get objects(): any[] {
        return this.data.objects;
    }

    public get gridSize(): Size {
        return Object.assign({}, this.data.gridSize);
    }

    public get focusData(): FocusData {
        return Object.assign({}, this.data.focusData);
    }

    public get activeElement(): ActiveElement {
        return Object.assign({}, this.data.activeElement);
    }

    public get objectStateClass(): any {
        return this.data.ObjectStateClass;
    }

    public get drawData(): DrawData {
        return Object.assign({}, this.data.drawData);
    }
}
