import * as d3 from 'd3';

export const SLOT_AXIS = 0;
export const SLOT_CIRCLE = 1;
export const SLOT_LINE = 2;
export const SLOT_TEXT_CIRCLE_LABEL = 3;
export const SLOT_TEXT_DISTANCE_LINE_LABEL = 4; // 这个是多例
export const SLOT_RECT = 5;

export function renewScales(refs) {
    const X = d3.map(refs.current.datasu, (_) => _.x); // 仅含X的列表
    const Y = d3.map(refs.current.datasu, (_) => _.y);
    const mx = refs.current.mx = 40; // margin x
    const my = refs.current.my = 20;
    const r = 3; // 圆点半径

    const ix = mx + 2 * r;
    const iy = my + 2 * r;

    const xRange = [ix, refs.current.mww - ix];
    const yRange = [refs.current.mwh - iy, my + iy];

    const xDomain = d3.nice(...d3.extent(X), refs.current.mww * 0.1); // x的领域，我们只渲染领域内的数据，导航的时候要用
    const yDomain = d3.nice(...d3.extent(Y), refs.current.mwh * 0.1);

    refs.current.xd = xDomain;
    refs.current.yd = yDomain;

    const xScale = d3.scaleLinear(xDomain, xRange);
    const yScale = d3.scaleLinear(yDomain, yRange);
    refs.current.xScale = xScale;
    refs.current.yScale = yScale;
    refs.current.xfunc = xScale;
    refs.current.yfunc = yScale;
}

export function ensureRenderSlots(refs) {
    if (refs.current.renderSlots === undefined) {
        // circle, line, textcircle, textdistance, rect
        refs.current.renderSlots = [[], [], [], [], [], []];
    }
}
export function ensureEmptySlot(refs, slotID) {
    if (refs.current.renderSlots[slotID].length !== 0) {
        for (const primitives of refs.current.renderSlots[slotID]) {
            primitives.destroy();
        }
        refs.current.renderSlots[slotID].length = 0;
    }
}
export function ensureAllEmptySlot(refs) {
    const slots = refs.current.renderSlots;
    for (let slotID = slots.length - 1; slotID >= 0; --slotID) {
        for (const primitives of slots[slotID]) {
            primitives.destroy();
        }
        slots[slotID].length = 0;
    }
}

export function rerenderBySlots(refs) {
    const slots = refs.current.renderSlots;
    for (let slotID = slots.length - 1; slotID >= 0; --slotID) {
        for (const primitives of slots[slotID]) {
            primitives.destroy();
            primitives.init();
        }
    }
}

export function dumpCommon(refs) {
    const slots = refs.current.renderSlots.map(i => i.map(j => j.dumps()));
    // for(const slot of refs.current.renderSlots) {
    //     const primitive_dicts = slot.map(x => x.dump());
    //     for(const primitive of slot) {
    //         primitive_dicts.push(primitive.dumps());
    //     }
    //     slots
    // }
    return JSON.stringify({
        "transform": refs.current.transform,
        "datasu": refs.current.datasu,
        "slots": slots
    });
}

export function loadCommon(refs, obj) {
    ensureRenderSlots(refs);
    refs.current.datasu = obj.datasu;
    // refs.current.pca_meta = obj.pca_meta; // 太卡了
    refs.current.select01.length = refs.current.datasu.length;
    renewScales(refs);
    if (obj.transform !== undefined) {
        refs.current.transform = new d3.ZoomTransform(obj.transform.k, obj.transform.x, obj.transform.y);
        applyZoomTransform(refs);
    } else {
        // refs.current.transform = new d3.ZoomTransform(1, 0, 0);
        // applyZoomTransform(refs);
    }
    for (let i = 0; i < refs.current.renderSlots.length; ++i)ensureEmptySlot(refs, i);
    for (const [idx, v] of Object.entries(obj.slots)) {
        for (const pri of v) {
            PRIMITIVES[idx].loads(refs, pri);
        }
    }
    rerenderBySlots(refs);
    // refs.current.resetZoom();
}

// 初始化svg的时候先调用这个
export function bindCallbacks(refs,
    setState_selectedPointInfo,
    dispatchSelectedPointInfo,
    hoverObject,
    setState_lockRefs,
    xScale,
    yScale,
    svg
) {
    refs.current.setState_selectedPointInfo = setState_selectedPointInfo;
    refs.current.dispatchSelectedPointInfo = dispatchSelectedPointInfo;
    refs.current.hoverObject = hoverObject;
    refs.current.setState_lockRefs = setState_lockRefs;
    refs.current.xScale = xScale;
    refs.current.yScale = yScale;
    refs.current.svg = svg;
}
// 隐式状态：transform，维护画布的zoom
export function applyZoomTransform(refs) {
    const nx = refs.current.transform.rescaleX(refs.current.xScale);
    const ny = refs.current.transform.rescaleY(refs.current.yScale);
    refs.current.xfunc = nx;
    refs.current.yfunc = ny;
    refs.current.xd = nx.domain();
    refs.current.yd = ny.domain();
}

// 尽量避免通过refs隐式传参
export class AxisNormal {
    constructor(refs) {
        this.refs = refs;
        ensureRenderSlots(refs);
        ensureEmptySlot(refs, SLOT_AXIS);
        refs.current.renderSlots[SLOT_AXIS].push(this);

        this.init();
    }
    init() {
        const refs = this.refs;
        const svg = refs.current.svg;
        const xScale = refs.current.xfunc;
        const yScale = refs.current.yfunc;
        const mx = refs.current.mx;
        const my = refs.current.my;

        const xAxis = d3.axisBottom(xScale).ticks(10);
        const yAxis = d3.axisLeft(yScale).ticks(10);
        // x轴
        this.xa = svg.append("g")
            .attr("transform", `translate(0,${refs.current.mwh - my})`)
            .call(xAxis)
            .call(g => g.select(".domain").remove())
            .call(g => g.selectAll(".tick line").clone()
                .attr("y2", my + my - refs.current.mwh)
                .attr("stroke-opacity", 0.1))
            .call(g => g.append("text")
                .attr("x", refs.current.mww)
                .attr("y", my - 4)
                .attr("fill", "currentColor")
                .attr("text-anchor", "end")
                // .text(xLabel)
            );

        // y轴
        this.ya = svg.append("g")
            .attr("transform", `translate(${mx},0)`)
            .call(yAxis)
            .call(g => g.select(".domain").remove())
            .call(g => g.selectAll(".tick line").clone()
                .attr("x2", refs.current.mww - mx - mx)
                .attr("stroke-opacity", 0.1))
            .call(g => g.append("text")
                .attr("x", -mx)
                .attr("y", 10)
                .attr("fill", "currentColor")
                .attr("text-anchor", "start")
            );
    }
    destroy() {
        if (this.xa) this.xa.remove();
        if (this.ya) this.ya.remove();
        this.xa = undefined;
        this.ya = undefined;
    }
    zoomed() {
        const refs = this.refs;
        // console.log(refs.current.renderSlots);
        this.xa.call(d3.axisBottom(refs.current.xfunc));
        this.ya.call(d3.axisLeft(refs.current.yfunc));
    }
    dumps() {
        return {};
    }
    static loads(refs, dict) {
        return new AxisNormal(refs);
    }
};

export class CircleNormal {
    constructor(refs) {
        this.refs = refs;

        ensureRenderSlots(refs);
        ensureEmptySlot(refs, SLOT_CIRCLE); // 独占
        refs.current.renderSlots[SLOT_CIRCLE].push(this);

        this.init();
    }

    init() {
        const refs = this.refs;
        const r = 3; // 半径
        const setState_selectedPointInfo = refs.current.setState_selectedPointInfo;
        const dispatchSelectedPointInfo = refs.current.dispatchSelectedPointInfo;
        const hoverObject = refs.current.hoverObject;
        const setState_lockRefs = refs.current.setState_lockRefs;

        const canvas = refs.current.canvas;
        const datasu = refs.current.datasu;
        const xScale = refs.current.xfunc;
        const yScale = refs.current.yfunc;

        this.cir = canvas
            .attr("fill", "white")
            .attr("stroke", "currentColor")
            .attr("stroke-width", 2)
            .selectAll("dot")
            .data(d3.range(datasu.length))
            .join("circle")
            .attr("cx", i => xScale(datasu[i].x))
            .attr("cy", i => yScale(datasu[i].y))
            .attr("r", r)
            .style("fill", "cyan")
            .on("mousedown", (e, i) => {
                const h = { id: i };
                Object.assign(h, datasu[i]);
                refs.current.lock_spi = true;
                setState_lockRefs(refs);

                setState_selectedPointInfo(h);
                dispatchSelectedPointInfo(h);

                hoverObject(e, h, 1, true);
            }).on("mouseover", (e, i) => {
                const h = { id: i };
                Object.assign(h, datasu[i]);
                console.log("mouseover event", e, i, h);
                console.log('h:', h);
                // console.log(refs.current);
                hoverObject(e, h, 1);
            })
            // .on("mousemove", (e, i) => {})
            .on("mouseleave", (e, i) => {
                hoverObject(e, null, 0);
            })
            ;
        // console.log('inited circles', refs.current.renderSlots);
    }

    destroy() {
        if (this.cir) this.cir.remove();
        this.cir = undefined;
    }

    zoomed() {
        const refs = this.refs;
        const datasu = refs.current.datasu;
        const xScale = refs.current.xfunc;
        const yScale = refs.current.yfunc;
        this.cir.attr("cx", i => xScale(datasu[i].x))
            .attr("cy", i => yScale(datasu[i].y))
    }
    dumps() {
        return {};
    }
    static loads(refs, dict) {
        return new CircleNormal(refs);
    }
};

export class LineNormal {
    constructor(refs) {
        this.refs = refs;

        ensureRenderSlots(refs);
        ensureEmptySlot(refs, SLOT_LINE);
        refs.current.renderSlots[SLOT_LINE].push(this);

        this.init();
    }
    init() {
        const refs = this.refs;
        const canvas = refs.current.canvas;
        const datasu = refs.current.datasu;
        const labelsu = [...new Set(datasu.map(x => x.l))];
        const xScale = refs.current.xfunc;
        const yScale = refs.current.yfunc;
        function nanfilter(x) {
            const xx = datasu[x].x;
            const yy = datasu[x].y;
            return xx !== undefined && yy !== undefined && !isNaN(xx) && !isNaN(yy);
        }

        function* genSeq() {
            console.log("labelsu:", labelsu, datasu);
            for (let [v, k] of Object.entries(labelsu)) {
                let fun = (x) => datasu[x].l === k;
                let color = "#005b00";
                if (k.length > 0) {
                    if (k.indexOf("_") !== -1) { // 有clamp
                        const [u1, u2] = k.split("_");
                        fun = (x) => {
                            return datasu[x].u === u1 || datasu[x].u === u2;
                            // datasu[x].l === k || // 只需要连首尾两个点就行了
                        };
                        color = "#ac1cff"
                    } else {
                        const sp = k.split('/');
                        const suff = sp.pop();
                        const pid = suff.split('.')[0];
                        console.log((sp.concat([pid])).join('/'));
                        fun = (x) => {
                            return (
                                (datasu[x].l === k) ||
                                (datasu[x].u === (sp.concat([pid])).join('/')) // 分支fork出来的地方要连上
                            );

                        };
                    }
                }
                console.log(k, fun, d3.filter(d3.range(datasu.length), (x) => nanfilter(x) && fun(x)));
                yield [d3.filter(d3.range(datasu.length), (x) => nanfilter(x) && fun(x)), color];
            }
        }
        this.paths = [];
        this.subseqs = [];
        const line = d3.line()
            .curve(d3.curveLinear)
            .x(i => xScale(datasu[i].x))
            .y(i => yScale(datasu[i].y));

        for (const [subseq, color] of genSeq()) {
            // console.log(subseq);
            const path = canvas.append("path")
                .attr("fill", "none")
                .attr("class", "line")
                .attr("stroke", color)
                .attr("stroke-width", 2)
                .attr("stroke-linejoin", "round")
                .attr("stroke-linecap", "round")
                .attr("d", line(subseq));
            this.subseqs.push(subseq);
            this.paths.push(path);
        }
        // console.log('inited lines:', this.subseqs, this.paths);
    }

    destroy() {
        if (this.paths) {
            for (const path of this.paths) {
                path.remove();
            }
        }
        this.paths.length = this.subseqs.length = 0;
    }

    zoomed() {
        const refs = this.refs;
        const datasu = refs.current.datasu;
        const xScale = refs.current.xfunc;
        const yScale = refs.current.yfunc;
        const nline = d3.line()
            .curve(d3.curveLinear)
            .x(i => xScale(datasu[i].x))
            .y(i => yScale(datasu[i].y));
        for (let idx = 0; idx < this.paths.length; idx++) {
            this.paths[idx]
                // .transition()
                .attr("d", nline(this.subseqs[idx]));
        }
    }

    dumps() {
        return {};
    }
    static loads(refs, dict) {
        return new LineNormal(refs);
    }
};

export class TextCircleLabel {
    constructor(refs) {
        this.refs = refs;

        ensureRenderSlots(refs);
        ensureEmptySlot(refs, SLOT_TEXT_CIRCLE_LABEL);
        refs.current.renderSlots[SLOT_TEXT_CIRCLE_LABEL].push(this);

        this.init();
    }
    init() {
        const refs = this.refs;
        const datasu = refs.current.datasu;
        const xScale = refs.current.xfunc;
        const yScale = refs.current.yfunc;


        this.label = refs.current.canvas.append("g").attr("font-family", "sans-serif")
            .attr("font-size", 10)
            .attr("stroke-linejoin", "round")
            .attr("stroke-linecap", "round")
            .attr("stroke-width", 0)
            .attr("fill", "black")
            .selectAll("text")
            .data(d3.range(datasu.length))
            .join("text")
            .attr("dx", 7)
            .attr("dy", "0.35em")
            .attr("x", i => xScale(datasu[i].x))
            .attr("y", i => yScale(datasu[i].y))
            .text(i => datasu[i].u)
            // .call(text => text.clone(true))
            // .attr("fill", "none")
            ;
    }


    destroy() {
        if (this.label) this.label.remove();
        this.label = undefined;
    }

    zoomed() {
        const refs = this.refs;
        const datasu = refs.current.datasu;
        const xScale = refs.current.xfunc;
        const yScale = refs.current.yfunc;

        this.label.attr("x", i => xScale(datasu[i].x))
            .attr("y", i => yScale(datasu[i].y))

    }
    dumps() {
        return {};
    }
    static loads(refs, dict) {
        return new TextCircleLabel(refs);
    }
};

// 两点距离连线图元，包括线和标签
export class TextDistanceLabel {
    static auto(refs, distance) {
        const datasu = refs.current.datasu;

        const si = d3.range(datasu.length).filter((x, i) => refs.current.select01[i]);
        const p1 = si[0];
        const p2 = si[1];

        return new TextDistanceLabel(refs, distance, datasu[p1].u, datasu[p2].u);
    }
    rearrange() {
        const refs = this.refs;
        const slot = refs.current.renderSlots[SLOT_TEXT_DISTANCE_LINE_LABEL];
        // 把末尾元素移过来
        if (slot.length > 1) {
            console.log('before arrange:', slot[this.index].index);
            slot[this.index] = slot[slot.length - 1];
            console.log('during arrange:', slot[this.index].index);
            slot[this.index].index = this.index;
            console.log('after arrange:', slot[this.index].index, slot);
            --slot.length;
        } else slot.length = 0;
    }
    constructor(refs, distance, u1, u2) {
        this.refs = refs;
        this.distance = distance;
        this.u1 = u1; this.u2 = u2;

        ensureRenderSlots(refs);
        this.index = refs.current.renderSlots[SLOT_TEXT_DISTANCE_LINE_LABEL].length;
        refs.current.renderSlots[SLOT_TEXT_DISTANCE_LINE_LABEL].push(this);

        this.init();
    }
    init() {
        const distance = this.distance;
        const refs = this.refs;
        const canvas = refs.current.canvas;
        const datasu = refs.current.datasu;
        const xScale = refs.current.xfunc;
        const yScale = refs.current.yfunc;

        const si = d3.range(datasu.length).filter(i =>
            datasu[i].u === this.u1 || datasu[i].u === this.u2);
        if (si.length < 2) {
            this.rearrange();
            return;
        }
        const p1 = si[0];
        const p2 = si[1];


        // 画连线
        const line = d3.line()
            .curve(d3.curveLinear)
            .x(i => xScale(datasu[i].x))
            .y(i => yScale(datasu[i].y));

        this.line = canvas.append("path")
            .attr("fill", "none")
            .attr("class", "line")
            .attr("stroke", "#bd16bb")
            .attr("stroke-width", 2)
            .attr("stroke-linejoin", "round")
            .attr("stroke-linecap", "round")
            .attr("d", line([p1, p2]))
            .on("mouseover", (e, i) => {
                this.line.attr("stroke", "#2BFAFF");
            }).on("mouseleave", (e, i) => {
                this.line.attr("stroke", "#bd16bb");
            }).on("mouseup", (e, i) => { // 在mouseup时禁止消息广播，可以禁用浏览器的右键菜单
                e.preventDefault();
                e.stopImmediatePropagation();
                if (e.button === 2) // 右键，左键是0
                {
                    this.destroy();
                    this.rearrange();
                }
                // console.log("line mouse down", e, i);
            });

        // 画距离
        this.label = canvas.append("g").attr("font-family", "sans-serif")
            .attr("font-size", 10)
            .attr("stroke-linejoin", "round")
            .attr("stroke-linecap", "round")
            .attr("stroke-width", 0)
            .attr("fill", "black")
            .selectAll("text")
            .data([0])
            .join("text")
            .attr("dx", 7)
            .attr("dy", "0.35em")
            .attr("x", i => xScale(d3.mean([datasu[p1].x, datasu[p2].x])))
            .attr("y", i => yScale(d3.mean([datasu[p1].y, datasu[p2].y])))
            .text(i => distance);
    }


    destroy() {
        if (this.label) this.label.remove();
        if (this.line) this.line.remove();

        this.label = undefined;
        this.line = undefined;
    }

    zoomed() {
        const refs = this.refs;
        const datasu = refs.current.datasu;
        const xScale = refs.current.xfunc;
        const yScale = refs.current.yfunc;
        const si = d3.range(datasu.length).filter(i =>
            datasu[i].u === this.u1 || datasu[i].u === this.u2);
        const p1 = si[0];
        const p2 = si[1];

        const line = d3.line()
            .curve(d3.curveLinear)
            .x(i => xScale(datasu[i].x))
            .y(i => yScale(datasu[i].y));

        this.line.attr("d", line([p1, p2]));

        this.label.attr("x", i => xScale(d3.mean([datasu[p1].x, datasu[p2].x])))
            .attr("y", i => yScale(d3.mean([datasu[p1].y, datasu[p2].y])));

    }

    dumps() {
        return {
            u1: this.u1,
            u2: this.u2,
            distance: this.distance
        };
    }
    static loads(refs, dict) {
        return new TextDistanceLabel(refs, dict.distance, dict.u1, dict.u2);
    }
};

export class RectNormal {
    constructor(refs, heatmapMeta, offset, rectSize) {
        this.refs = refs;
        this.heatmapMeta = heatmapMeta;
        this.offset = offset;
        this.rectSize = rectSize;

        ensureRenderSlots(refs);
        ensureEmptySlot(refs, SLOT_RECT);
        refs.current.renderSlots[SLOT_RECT].push(this);

        rerenderBySlots(refs);

    }
    init() {
        const refs = this.refs;
        const offset = this.offset;
        const canvas = refs.current.canvas;
        const heatmapMeta = this.heatmapMeta;
        const mapped = heatmapMeta.map(i => Math.log(i.trl));
        const ext = d3.extent(mapped);
        const myColor = d3.scaleSequential()
            .interpolator(d3.interpolateInferno)
            .domain(ext);
        this.rects = canvas
            .selectAll()
            .data(heatmapMeta)
            .enter()
            .append("rect")
            .attr("x", i => refs.current.xfunc(i.x + offset[0]) - this.rectSize / 2)
            .attr("y", i => refs.current.yfunc(i.y + offset[1]) - this.rectSize / 2)
            .attr("rx", 4)
            .attr("ry", 4)
            .attr("width", this.rectSize)
            .attr("height", this.rectSize)
            .style("fill", i => myColor(Math.log(i.trl)))
            // .style("stroke-width", 4)
            .style("stroke", "none")
            .style("opacity", 0.8)
            .on("mouseover", (e, i) => {
                console.log("mouseover event", e, i);
                const infos = { id: 0, u: `train loss: ${i.trl}`, x: i.x + offset[0], y: i.y + offset[1] };
                Object.assign(infos, i);
                refs.current.hoverObject(e, infos, 1);
            })
            .on("mouseleave", (e, i) => {
                refs.current.hoverObject(e, null, 0);
            });
    }

    destroy() {
        if (this.rects) this.rects.remove();
        this.rects = undefined;
    }

    zoomed() {
        const refs = this.refs;
        this.rects
            .attr("x", i => refs.current.xfunc(i.x + this.offset[0]) - this.rectSize / 2)
            .attr("y", i => refs.current.yfunc(i.y + this.offset[1]) - this.rectSize / 2);
    }

    dumps() {
        return {
            hmmt: this.heatmapMeta,
            offset: this.offset,
            sz: this.rectSize
        };
    }

    static loads(refs, dict) {
        return new RectNormal(refs, dict.hmmt, dict.offset, dict.sz);
    }

};

const PRIMITIVES = [
    AxisNormal,
    CircleNormal,
    LineNormal,
    TextCircleLabel,
    TextDistanceLabel,
    RectNormal
];