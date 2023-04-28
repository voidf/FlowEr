import * as React from 'react';
import Draggable from 'react-draggable';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import { Tooltip, Divider, ListItemText, ListItem, List, Grid, Toolbar, Stack, Select, FormControl, InputLabel, MenuItem, Button, TextField, Card, CardContent, Slider, InputAdornment, AppBar, IconButton } from '@mui/material';
import * as d3 from 'd3';
import { pointer, selection } from 'd3';
import SelectAllIcon from '@mui/icons-material/SelectAll';
import ClearIcon from '@mui/icons-material/Clear';
import DeselectIcon from '@mui/icons-material/Deselect';
import AppsIcon from '@mui/icons-material/Apps';
import AppsOutageIcon from '@mui/icons-material/AppsOutage';
import LineAxisIcon from '@mui/icons-material/LineAxis';
import TimelineIcon from '@mui/icons-material/Timeline';
import DeleteIcon from '@mui/icons-material/Delete';
import SaveIcon from '@mui/icons-material/Save';
import CheckIcon from '@mui/icons-material/Check';
import LinearScaleIcon from '@mui/icons-material/LinearScale';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import {
  CircleNormal, LineNormal, TextCircleLabel, TextDistanceLabel, RectNormal, AxisNormal,
  ensureRenderSlots, ensureEmptySlot, ensureAllEmptySlot,
  bindCallbacks, applyZoomTransform, dumpCommon, loadCommon,
  SLOT_CIRCLE, SLOT_TEXT_CIRCLE_LABEL, SLOT_TEXT_DISTANCE_LINE_LABEL, SLOT_LINE, SLOT_RECT, SLOT_AXIS
} from './d3elem';

import { API } from './utils';

import axios from 'axios';

function rename_key(o, old_key, new_key) {
  if (old_key !== new_key) {
    Object.defineProperty(o, new_key,
      Object.getOwnPropertyDescriptor(o, old_key));
    delete o[old_key];
  }
}

export default function App() {
  // const xticks = 20;
  // const yticks = 10;

  const heatmap_rect_size = 60;
  const [state_windowHeight, setState_windowHeight] = React.useState(1080);
  React.useEffect(() => {
    const resizeObserver = new ResizeObserver((event) => {
      if (refs.current.lock_windowsize === undefined) {
        refs.current.mww = event[0].contentBoxSize[0].inlineSize;
        refs.current.mwh = event[0].contentBoxSize[0].blockSize;
        setState_windowHeight(window.innerHeight - 10);
      }
    });
    resizeObserver.observe(document.getElementById("main-view"));
    const rso2 = new ResizeObserver(e => {
      if (r2.current.lock_windowsize === undefined) {
        r2.current.mww = e[0].contentBoxSize[0].inlineSize;
        r2.current.mwh = e[0].contentBoxSize[0].blockSize;
      }
    });
    rso2.observe(document.getElementById("lossgraph-view"));
  });

  const [state_projectList, setState_projectList] = React.useState([]); // 项目表

  // const [proj, setProj] = React.useState('');

  // 选中检查点的基本信息
  const [state_hoverInfo, setState_hoverInfo] = React.useState(null); // 这个包括热力图的选中信息，用于hover
  // {id, lr, batch_size, momentum, weight_decay, random_seed, optimizer, epoch} 即datasu里的所有信息
  const [state_selectedPointInfo, setState_selectedPointInfo] = React.useState(null);

  const [state_learningRate, setState_learningRate] = React.useState('0.1');
  const [state_batchSize, setState_batchSize] = React.useState('128');
  const [state_momentum, setState_momentum] = React.useState('0.9');
  const [state_weightDecay, setState_weightDecay] = React.useState('0.0001');
  const [state_randomSeed, setState_randomSeed] = React.useState('29');
  const [state_optimizer, setState_optimizer] = React.useState('sgd');
  const [state_toEpoch, setState_toEpoch] = React.useState('0');
  const [state_disturbMagnitude, setState_disturbMagnitude] = React.useState('0.001');

  const archs = [
    'resnet56', 'resnet56_noshort', 'vgg9', 'densenet121'
  ];

  function dispatchSelectedPointInfo(x) {
    setState_learningRate(x.lr + '');
    setState_batchSize(x.batch_size + '');
    setState_momentum(x.momentum + '');
    setState_weightDecay(x.weight_decay + '');
    setState_randomSeed(x.random_seed + '');
    setState_optimizer(x.optimizer + '');
    setState_toEpoch(x.epoch + 1 + '');
  }

  // 浮窗状态
  const [state_floatingBoxX, setState_floatingBoxX] = React.useState(0);
  const [state_floatingBoxY, setState_floatingBoxY] = React.useState(0);
  const [state_floatingBoxOpacity, setState_floatingBoxOpacity] = React.useState(0);
  const [state_lockRefs, setState_lockRefs] = React.useState(undefined);
  //
  const [state_snapshots, setState_snapshots] = React.useState([]);
  const [state_clampCount, setState_clampCount] = React.useState('3');

  const floatingBoxWidth = 300;

  // 这个函数不会被重新渲染，它的状态必须记在ref里
  function hoverObject(e, dict, opa = 1, forced = false) {
    if (!forced && refs.current.lock_spi) return;
    setState_floatingBoxX(e.clientX);
    setState_floatingBoxY(e.clientY);
    setState_hoverInfo(dict);
    setState_floatingBoxOpacity(opa);
  }

  /*  会失焦
  function PairText({ l1, o1, s1, f1, l2, o2, s2, f2 }) {
    return <Stack direction='row' sx={{flexGrow: 1}}>
      <TextField
        key={l1+l2}
        size='small'
        sx={{ mr: .5 }}
        label={l1 + (o1 + '' === s1 ? "" : "*")}
        variant="outlined"
        value={s1}
        onChange={e => f1(e.target.value)} />
      <TextField
        key={l2+l1}
        size='small'
        label={l2 + (o2 + '' === s2 ? "" : "*")}
        variant="outlined"
        value={s2}
        onChange={e => f2(e.target.value)} />
    </Stack>
  }
  */
  // 选区逻辑对外同步用，su是选中检查点的u字符串
  const [state_selectedPointUniqueID, setState_selectedPointUniqueID] = React.useState([]);


  function requestProjData(refs, after_that = () => { }) {
    const p = refs.current.proj;
    axios.get(API('/list?proj=' + p)).then(
      (data) => {
        refs.current.datasu = data.data.points;
        request_datasu_meta(refs);
        after_that();
      });
    getSnapshots();
  }

  function getSnapshots() {
    axios.get(API("/snapshot?proj=" + getProj())).then(resp => {
      console.log(resp);
      setState_snapshots(resp.data);
    });
  }

  React.useEffect(() => {
    if (state_projectList.length == 0) {
      axios.get(API('/models')).then((data) => {
        console.log(data);
        setState_projectList(data.data);
        refs.current.lock_windowsize = true; // 锁定大小
      });
    }
  }, []);

  // Plot

  const ref_component = React.useRef();
  const refs = React.useRef({ su: [], xfunc: null, yfunc: null, select01: [], circles: null });
  const lossgraph_component = React.useRef();
  const r2 = React.useRef({});

  function updateProj(a) { refs.current.proj = a; }
  function getProj() { return refs.current.proj; }

  const dispatchRefs = [refs, r2];
  function updateSelectedCircles(refs) {
    refs.current.su = refs.current.datasu.filter((x, i) => refs.current.select01[i]).map(_ => _.u);
    setState_selectedPointUniqueID(refs.current.su);

    for (const dispatchRef of dispatchRefs) {
      ensureRenderSlots(dispatchRef);
      if (!dispatchRef.current.renderSlots[SLOT_CIRCLE]) return;
      dispatchRef.current.su = refs.current.su;
      dispatchRef.current.select01 = refs.current.select01;
      if (dispatchRef.current.renderSlots[SLOT_CIRCLE].length > 0) {
        const circles = dispatchRef.current.renderSlots[SLOT_CIRCLE][0].cir;
        console.log('circles:', circles);
        circles.style("stroke", "black")
          .style("fill", "cyan");
        circles.filter(i => dispatchRef.current.select01[i])
          .style("stroke", "red")
          .style("fill", "red");
      }
    }

  };


  // 禁止事件广播
  function noevent(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }


  function initSvg(svg, refs) {
    // console.log("init svg:", refs.current.datasu);

    const X = d3.map(refs.current.datasu, (_) => _.x); // 仅含X的列表
    const Y = d3.map(refs.current.datasu, (_) => _.y);
    // svg.selectAll("*").remove();
    refs.current.select01 = Array(refs.current.datasu.length).fill(false);
    const r = 3; // 圆点半径
    const mx = refs.current.mx = 40; // margin x
    const my = refs.current.my = 20;

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

    bindCallbacks(refs,
      setState_selectedPointInfo,
      dispatchSelectedPointInfo,
      hoverObject,
      setState_lockRefs,
      xScale,
      yScale,
      svg
    );

    refs.current.xfunc = xScale;
    refs.current.yfunc = yScale;


    svg
      .attr("width", refs.current.mww)
      .attr("height", refs.current.mwh)
      .attr("viewBox", [0, 0, refs.current.mww, refs.current.mwh])
      .attr("style", "max-width: 100%; height: auto; height: intrinsic;");

    const clip = svg.append("defs").append("SVG:clipPath")
      .attr("id", "clip")
      .append("SVG:rect")
      .attr("width", refs.current.mww)
      .attr("height", refs.current.mwh)
      .attr("x", 0)
      .attr("y", 0);


    const pan = svg.append("rect")
      .attr("width", refs.current.mww)
      .attr("height", refs.current.mwh)
      .style("fill", "none")
      .style("pointer-events", "all")
      .style("z-index", "-1")
      .attr('transform', 'translate(' + mx + ',' + my + ')');

    const canvas = refs.current.canvas = svg.append("g")
      .style("z-index", "999")
      .attr("clip-path", "url(#clip)")
      ;

    // const slots = refs.current.renderSlots;
    ensureRenderSlots(refs);
    ensureAllEmptySlot(refs);
    new AxisNormal(refs, svg);
    // 清理点槽方块槽和线槽，保留连接槽 
    // 重绘线和点，更新连接状态
    new LineNormal(refs);
    // const [paths, subseqs] = renderLines(refs);
    // refs.current.paths = paths;
    // refs.current.subseqs = subseqs;
    new CircleNormal(refs,
      setState_selectedPointInfo,
      dispatchSelectedPointInfo,
      hoverObject,
      setState_lockRefs,
    );
    for (const conn of refs.current.renderSlots[SLOT_TEXT_DISTANCE_LINE_LABEL]) {
      conn.destroy();
      conn.init();
    }

    // refs.current.circles = renderCircles(refs, r);

    function zoomed(e) {
      // console.log('zoomed event', e, e.transform);
      refs.current.transform = e.transform;
      applyZoomTransform(refs);

      // 处理热力图方块
      // if (refs.current.rects) {
      //   canvas.selectAll('rect')
      //     .attr("x", i => refs.current.xfunc(i.x + refs.current.offset[0]) - refs.current.new_heatmap_rect_size / 2)
      //     .attr("y", i => refs.current.yfunc(i.y + refs.current.offset[1]) - refs.current.new_heatmap_rect_size / 2);
      // }


      for (const slots of refs.current.renderSlots) {
        for (const primitives of slots) {
          primitives.zoomed();
        }
      }
    }

    const zoom = d3.zoom()
      .on("zoom", zoomed)
      ;
    pan.call(zoom);
    // refs.current.resetZoom = () => { console.log(zoom); console.log(pan); pan.__zoom = new d3.ZoomTransform(1, 0, 0); };

    const originalMouseDown = pan.on("mousedown.zoom");
    // pan.on("mouseover", function (e, i) { console.log(e, i) });
    // 选区逻辑
    pan.on("mousedown.zoom", function (e, ...args) {
      if (e.shiftKey) {
        originalMouseDown.call(this, e, ...args);
      } else {
        var that = this,
          p = Array.from(e.touches || [e], t => {
            t = pointer(t, that);
            return t;
          });
        // const pts = [p[0], p[1] || p[0]];


        if (!e.ctrlKey) {
          var v = d3.select(e.view).on("mousemove.zoom", mousemoved, true).on("mouseup.zoom", mouseupped, true);
          return;
        }
        else {
          var poly = refs.current.canvas.append('g');
          var pl = [[p[0][0] + ix, p[0][1] + iy]];
          var v = d3.select(e.view).on("mousemove.zoom", mousemovedCTRL, true).on("mouseup.zoom", mouseuppedCTRL, true);
          var li = d3.line().curve(d3.curveLinear).x(_ => _[0]).y(_ => _[1]);

        }
        function mousemoved(e) {

          const cursor_pos = Array.from(e.touches || [e], t => {
            t = pointer(t, that);
            return t;
          })[0];
          // console.log("moving", cursor_pos[0], cursor_pos[1]);
          console.log("before selected count:", d3.sum(refs.current.select01));

          d3.range(refs.current.datasu.length).map((i) => {
            const xp = refs.current.xfunc(refs.current.datasu[i].x) - cursor_pos[0] - ix;
            const yp = refs.current.yfunc(refs.current.datasu[i].y) - cursor_pos[1] - iy;
            refs.current.select01[i] = xp * xp + yp * yp <= 64 ? (e.altKey ? false : true) : refs.current.select01[i];
          });
          updateSelectedCircles(refs);

          console.log("selected count:", d3.sum(refs.current.select01));
          noevent(e);
        }
        function mouseupped(e) {
          v.on("mousemove.zoom mouseup.zoom", null);
          noevent(e);
        }


        function mousemovedCTRL(e) {
          const cursor_pos = Array.from(e.touches || [e], t => {
            t = pointer(t, that);
            return t;
          })[0];
          const cp = [cursor_pos[0] + ix, cursor_pos[1] + iy];


          const lpos = [pl[pl.length - 1], cp];
          pl.push(cp);
          poly.append("path")
            .attr("fill", "none")
            .attr("class", "line")
            .attr("stroke", "#00e1d5")
            .attr("stroke-width", 2)
            .attr("stroke-linejoin", "round")
            .attr("stroke-linecap", "round")
            .attr("d", li(lpos));
          noevent(e);
        }
        function mouseuppedCTRL(e) {
          function is_left(p0, p1, p2) {
            return (p1[0] - p0[0]) * (p2[1] - p0[1]) - (p2[0] - p0[0]) * (p1[1] - p0[1]);
          }
          function is_inner(xx, yy) {
            // winding_number by chatgpt
            let wn = 0;
            let j = pl[pl.length - 1];
            for (const i of pl) {
              if (j[1] <= yy) {
                if (i[1] > yy) if (is_left(j, i, [xx, yy]) > 0) ++wn;
              }
              else {
                if (i[1] <= yy) if (is_left(j, i, [xx, yy]) < 0) --wn;
              }
              j = i;
            }
            return (wn & 1) == 1;
          }
          d3.range(refs.current.datasu.length).map(i => {
            refs.current.select01[i] = is_inner(refs.current.xfunc(refs.current.datasu[i].x), refs.current.yfunc(refs.current.datasu[i].y)) ? (e.altKey ? false : true) : refs.current.select01[i];
          });
          updateSelectedCircles(refs);
          console.log(pl);


          v.on("mousemove.zoom mouseup.zoom", null);
          pl = undefined;
          poly.remove();
          poly = undefined;
          li = undefined;
          noevent(e);
        }
      }
    });
  }


  function request_datasu_meta(refs) {
    axios.post(API('/meta'), {
      proj: getProj(),
      selection: refs.current.datasu.map(_ => _.u),
    }).then(resp => {
      for (const [p, i] of Object.entries(resp.data)) {
        for (const [k, v] of Object.entries(i)) {
          refs.current.datasu[p][k] = v;
          if (k === "clamp") { // 将插值点信息覆写到l属性中
            refs.current.datasu[p].l = v.split('_').slice(0, 2).join('_');
            console.log('clamp point:', refs.current.datasu[p]);
          }
        }
      }
    });
  }

  function render_second_graph(y_property = undefined) {
    r2.current.lock_windowsize = true;

    if (y_property === undefined) y_property = refs.current.show_property;
    r2.current.datasu = refs.current.datasu.map((i, p) => {
      const h = {};
      Object.assign(h, i);
      h.x = h.epoch;
      h.y = h[y_property];
      return h;
    });
    console.log(r2.current);
    initSvg(d3.select(lossgraph_component.current), r2);
  }



  return (
    <Container maxWidth="false">
      {state_floatingBoxOpacity === 1 && state_hoverInfo && <Draggable>
        <Box sx={{
          position: 'fixed',
          top: state_floatingBoxY + 20 + 'px',
          left: state_floatingBoxX - floatingBoxWidth - 20 + 'px',
          // transform: state_floatingBoxY < 400 ? 'translate(-100%, 0%)' : 'translate(-100%, -100%)',
          width: floatingBoxWidth,
          textAlign: 'center',
          backgroundColor: 'primary.dark',
          opacity: state_floatingBoxOpacity,
          zIndex: 999,
        }}>
          <Card>
            <CardContent>

              {state_selectedPointInfo &&
                <IconButton color="inherit"
                  sx={{
                    position: 'fixed',
                    top: '0px',
                    right: '0px',
                    // left: '0px',
                    // verticalAlign: 'right'
                  }}
                  onClick={_ => {
                    state_lockRefs.current.lock_spi = undefined;
                    setState_hoverInfo({ id: -1 }); // 浮窗的X被点击
                    setState_selectedPointInfo(null);
                    setState_floatingBoxOpacity(0);
                  }}>
                  <ClearIcon />
                </IconButton>}
              <Typography>#{state_hoverInfo.id}</Typography>
              {state_hoverInfo.u && <>
                <Typography sx={{ fontSize: 14 }} color="text.secondary">{`unique_id: ${state_hoverInfo.u}`}</Typography>
              </>}
              {state_hoverInfo.trl && <>
                <Typography sx={{ fontSize: 14 }} color="text.secondary">{`train: ${state_hoverInfo.trl.toFixed(3)} (${state_hoverInfo.tra.toFixed(2)}%)`}</Typography>
                <Typography sx={{ fontSize: 14 }} color="text.secondary">{`test: ${state_hoverInfo.tel.toFixed(3)} (${state_hoverInfo.tea.toFixed(2)}%)`}</Typography>
              </>}
              {state_selectedPointInfo &&
                <Stack spacing={2} sx={{ my: 1.5 }}>

                  {/* <PairText l1="learning rate" o1={spi.lr} s1={tlr} f1={stlr}
                  l2="batch size" o2={spi.batch_size} s2={tbs} f2={stbs} />
                <PairText l1="momentum" o1={spi.momentum} s1={tmom} f1={stmom}
                  l2="weight decay" o2={spi.weight_decay} s2={twd} f2={stwd} />
                <PairText l1="random seed" o1={spi.random_seed} s1={tsd} f1={stsd}
                  l2="optimizer" o2={spi.optimizer} s2={top} f2={stop} /> */}

                  <Stack direction='row'>
                    <TextField
                      size='small'
                      sx={{ mr: 1 }}
                      label={"learning rate" + (state_selectedPointInfo.lr + '' === state_learningRate ? "" : "*")}
                      variant="outlined"
                      value={state_learningRate}
                      onChange={e => setState_learningRate(e.target.value)} />
                    <TextField
                      size='small'
                      label={"batch size" + (state_selectedPointInfo.batch_size + '' === state_batchSize ? "" : "*")}
                      variant="outlined"
                      value={state_batchSize}
                      onChange={e => setState_batchSize(e.target.value)} />
                  </Stack>
                  <Stack direction="row">
                    <TextField
                      sx={{ mr: 1 }}
                      size='small'
                      label={"momentum" + (state_selectedPointInfo.momentum + '' === state_momentum ? "" : "*")}
                      variant="outlined"
                      value={state_momentum}
                      onChange={e => setState_momentum(e.target.value)} />
                    <TextField
                      size='small'
                      label={"weight decay" + (state_selectedPointInfo.weight_decay + '' === state_weightDecay ? "" : "*")}
                      variant="outlined"
                      value={state_weightDecay}
                      onChange={e => setState_weightDecay(e.target.value)} />
                  </Stack>
                  <Stack direction="row">
                    <TextField
                      sx={{ mr: 1 }}
                      size='small'
                      label={"random seed" + (state_selectedPointInfo.random_seed + '' === state_randomSeed ? "" : "*")}
                      variant="outlined"
                      onChange={e => setState_randomSeed(e.target.value)}
                      value={state_randomSeed} />
                    <TextField
                      size='small'
                      label={"optimizer" + (state_selectedPointInfo.optimizer + '' === state_optimizer ? "" : "*")}
                      variant="outlined"
                      onChange={e => setState_optimizer(e.target.value)}
                      value={state_optimizer} />
                  </Stack>

                  <Stack direction="row">
                    <TextField
                      sx={{ mr: .5 }}
                      size='small'
                      label="to epoch"
                      variant="outlined"
                      value={state_toEpoch}
                      onChange={e => setState_toEpoch(e.target.value)} />
                    <TextField
                      size='small'
                      label="disturb magnitude"
                      variant="outlined"
                      value={state_disturbMagnitude}
                      onChange={e => setState_disturbMagnitude(e.target.value)} />
                  </Stack>
                  <Stack direction="row">
                    <Button
                      sx={{ mx: .5 }}
                      fullWidth
                      variant="contained"
                      onClick={() => dispatchSelectedPointInfo(state_selectedPointInfo)}>reset</Button>
                    <Button
                      sx={{ mx: .5 }}
                      fullWidth

                      variant="contained"
                      onClick={_ => {
                        const req_body = {
                          u: state_selectedPointInfo.u,
                          lr: Number(state_learningRate),
                          bs: Number(state_batchSize),
                          mom: Number(state_momentum),
                          wd: Number(state_weightDecay),
                          seed: Number(state_randomSeed),
                          op: state_optimizer,
                          e: Number(state_toEpoch),
                          proj: refs.current.proj
                        };
                        console.log(req_body);
                        axios.post(API("/train"), req_body).then(resp => {
                          console.log("train task submitted.", resp);
                          // requestProjData(refs);
                        });
                      }}>train</Button>

                    <Button
                      sx={{ mx: .5 }}
                      fullWidth

                      variant="contained"
                      onClick={(event) => {
                        axios.post(API("/disturb"), {
                          u: state_selectedPointInfo.u,
                          mag: state_disturbMagnitude,
                          proj: refs.current.proj
                        }).then(resp => {
                          console.log(resp);
                          // requestProjData(refs);
                        });
                      }}>disturb</Button>
                  </Stack>

                </Stack>
              }

            </CardContent>
          </Card>
        </Box>
      </Draggable>
      }

      <Stack direction="row" spacing={1} sx={{ height: state_windowHeight }}>
        <Box align='left' sx={{ border: 2, flexDirection: 'row', flex: 1 }}>
          <Container maxWidth="false">

            <Stack direction="row" sx={{ my: 1 }}>
              <Box align='left' sx={{ flexDirection: 'row', flex: .5, m: 1 }}>
                <FormControl variant="standard" fullWidth>
                  <InputLabel variant="standard">
                    Project
                  </InputLabel>
                  <Select
                    onChange={(event) => { updateProj(event.target.value); requestProjData(refs, () => initSvg(d3.select(ref_component.current), refs)) }}
                  >
                    {
                      state_projectList.map((x) => (<MenuItem key={x} value={x}>{x}</MenuItem>))
                    }
                  </Select>
                </FormControl>
              </Box>

            </Stack>

            <Divider variant="middle" />
            <Typography sx={{ my: 1.5 }}>Second Graph Property:</Typography>
            <Stack direction="row">
              <Button
                sx={{ mx: .5 }}
                fullWidth
                variant="contained"
                onClick={(event) => {
                  refs.current.show_property = "tra"
                  render_second_graph();
                }}>train accuracy</Button>
              <Button
                sx={{ mx: .5 }}
                fullWidth
                variant="contained"
                onClick={(event) => {
                  refs.current.show_property = "trl"
                  render_second_graph();
                }}>train loss</Button>
              <Button
                sx={{ mx: .5 }}
                fullWidth
                variant="contained"
                onClick={(event) => {
                  refs.current.show_property = "tea"
                  render_second_graph();
                }}>test accuracy</Button>
              <Button
                sx={{ mx: .5 }}
                fullWidth
                variant="contained"
                onClick={(event) => {
                  refs.current.show_property = "tel"
                  render_second_graph();
                }}>test loss</Button>
            </Stack>

            <Divider sx={{ my: 1.5 }} variant="middle" />
            {/* 两点插值 */}
            <Typography sx={{ my: 1.5 }}>{
              state_selectedPointUniqueID.length !== 2 ?
                "select 2 points to interpolate..." :
                `linear interpolate between ${state_selectedPointUniqueID[0]} and ${state_selectedPointUniqueID[1]}`
            }</Typography>
            <Stack direction="row">
              <TextField
                size='small'
                label="interpolation count"
                variant="outlined"
                value={state_clampCount}
                onChange={e => setState_clampCount(e.target.value)} />
              <Button
                sx={{ mx: .5 }}
                variant="contained"
                disabled={state_selectedPointUniqueID.length !== 2}
                onClick={_ => {
                  axios.post(API("/clamp"), {
                    proj: getProj(),
                    ctr: parseInt(state_clampCount),
                    u1: refs.current.su[0],
                    u2: refs.current.su[1],
                  }).then(resp => {
                    console.log(resp);
                  });
                }}>submit</Button>
            </Stack>
            {/* 快照面板 */}
            <Divider sx={{ my: 1.5 }} variant="middle" />
            <Typography sx={{ my: 1.5 }}>Saved Snapshots:</Typography>
            <List dense={true}>
              {
                state_snapshots.map((i, p) => {
                  const j = JSON.parse(i);
                  // console.log(p, j);
                  const d = new Date(j.t * 1000);
                  return (<ListItem
                    key={p}
                    secondaryAction={<>
                      <IconButton edge="end" sx={{ mr: 0.25 }} onClick={e => {
                        loadCommon(refs, j);
                      }}>
                        <CheckIcon />
                      </IconButton>
                      <IconButton edge="end" onClick={e => {
                        console.log({ proj: getProj(), index: p });
                        // delete方法要写data:
                        axios.delete(API("/snapshot"), { data: { proj: getProj(), index: p } }).then(_ => getSnapshots());
                      }}>
                        <DeleteIcon />
                      </IconButton></>
                    }>
                    <ListItemText>
                      {d.toISOString()}
                    </ListItemText>
                    <ListItemText>
                      {j.datasu.length + ' points'}
                    </ListItemText>
                  </ListItem>);
                })
              }
            </List>

          </Container>

        </Box>
        {/* 工具栏 */}
        <Box align='left' sx={{ border: 2, flexDirection: 'column', flex: 2 }} style={{ display: 'flex' }}>
          <AppBar color="primary" position="static" sx={{ top: 'auto', bottom: 0 }}>
            <Toolbar>
              <Tooltip title="Select All">
                <IconButton color="inherit"
                  onClick={(e) => {
                    refs.current.select01.fill(true);
                    updateSelectedCircles(refs);
                    console.log("after select all: ", d3.sum(refs.current.select01));
                  }}>
                  <SelectAllIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Unselect All">
                <IconButton color="inherit"
                  onClick={(e) => {
                    refs.current.select01.fill(false);
                    updateSelectedCircles(refs);
                    console.log("after clear: ", d3.sum(refs.current.select01));
                  }}>
                  <DeselectIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="PCA Projection">
                <IconButton color="inherit"
                  onClick={(e) => {
                    axios.post(API('/pca'), {
                      proj: getProj(),
                      selection: refs.current.su
                    }).then(resp => {
                      // console.log('pca done');
                      console.log(resp);
                      console.log(resp.data);
                      console.log(resp.data.coord);
                      resp.data.coord.map((x, i) => {
                        refs.current.datasu[i] = x;
                      });
                      refs.current.select01.length = refs.current.datasu.length = resp.data.coord.length;
                      // console.log('data:', refs.current.datasu);
                      request_datasu_meta(refs);
                      initSvg(d3.select(ref_component.current), refs);
                    });
                  }}>
                  <TimelineIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="T-SNE Projection">
                <IconButton color="inherit"
                  onClick={(e) => {
                    axios.post(API('/tsne'), {
                      proj: getProj(),
                      selection: refs.current.su
                    }).then(resp => {
                      // console.log('pca done');
                      // console.log(resp.data);
                      resp.data.coord.map((x, i) => {
                        refs.current.datasu[i] = x;
                      });
                      refs.current.select01.length = refs.current.datasu.length = resp.data.coord.length;
                      // console.log('data:', refs.current.datasu);
                      request_datasu_meta(refs);
                      initSvg(d3.select(ref_component.current), refs);
                    });
                  }}>
                  <TimelineIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="T-SNE Without Pre PCA">
                <IconButton color="inherit"
                  onClick={(e) => {
                    axios.post(API('/tsne?pre_pca=0'), {
                      proj: getProj(),
                      selection: refs.current.su
                    }).then(resp => {
                      // console.log('pca done');
                      // console.log(resp.data);
                      resp.data.coord.map((x, i) => {
                        refs.current.datasu[i] = x;
                      });
                      refs.current.select01.length = refs.current.datasu.length = resp.data.coord.length;
                      // console.log('data:', refs.current.datasu);
                      request_datasu_meta(refs);
                      initSvg(d3.select(ref_component.current), refs);
                    });
                  }}>
                  <TimelineIcon />
                </IconButton>
              </Tooltip>

              {/* <IconButton color="inherit"
                onClick={(e) => {
                  const xm = d3.mean(refs.current.datasu.map(_ => _.x));
                  const ym = d3.mean(refs.current.datasu.map(_ => _.y));
                  const dxm = d3.mean(refs.current.xd);
                  const dym = d3.mean(refs.current.yd);
                  console.log(xm, ym, dxm, dym);
                  const xticks = refs.current.mww / heatmap_rect_size;
                  const yticks = refs.current.mwh / heatmap_rect_size;
                  console.log({
                    xstep: Math.ceil(xticks / 2),
                    ystep: Math.ceil(yticks / 2),
                    xstep_rate: (refs.current.xd[1] - refs.current.xd[0]) / xticks,
                    ystep_rate: (refs.current.yd[1] - refs.current.yd[0]) / yticks,
                    // weight mode: len(axis) < len(mean)
                    mean: refs.current.pca_meta.mean.map((e, i) => e + (i >= refs.current.pca_meta.axis.length ? 0 : refs.current.pca_meta.mean[i] + (dxm - xm) * refs.current.pca_meta.axis[0][i] + (dym - ym) * refs.current.pca_meta.axis[1][i])),
                    xdir: refs.current.pca_meta.axis[0],
                    ydir: refs.current.pca_meta.axis[1],
                  });
                  axios.post(API('/heatmap'), {
                    xstep: 1,
                    ystep: 1,
                    proj: getProj(),
                    // xstep: Math.ceil(xticks / 2),
                    // ystep: Math.ceil(yticks / 2),
                    xstep_rate: (refs.current.xd[1] - refs.current.xd[0]) / xticks,
                    ystep_rate: (refs.current.yd[1] - refs.current.yd[0]) / yticks,
                    mean: refs.current.pca_meta.mean.map((e, i) => e + (i >= refs.current.pca_meta.axis.length ? 0 : refs.current.pca_meta.mean[i] + (dxm - xm) * refs.current.pca_meta.axis[0][i] + (dym - ym) * refs.current.pca_meta.axis[1][i])),
                    xdir: refs.current.pca_meta.axis[0],
                    ydir: refs.current.pca_meta.axis[1],
                  }).then(resp => {
                    new RectNormal(refs, resp.data,
                      refs.current.pca_meta.pmean,
                      Math.abs(refs.current.xfunc(0) - refs.current.xfunc((refs.current.xd[1] - refs.current.xd[0]) / xticks)),
                      hoverObject
                    );

                  });
                }}>
                <AppsIcon />
              </IconButton> */}
              <Tooltip title="Render Heatmap On Selected Point">

                <IconButton color="inherit"
                  disabled={!state_selectedPointInfo}
                  onClick={(e) => {
                    // const X = refs.current.datasu.map(_ => _.x);
                    // const Y = refs.current.datasu.map(_ => _.y);
                    const datasu = refs.current.datasu;
                    // const xm = d3.mean(X);
                    // const ym = d3.mean(Y);
                    // const dxm = d3.mean(refs.current.xd);
                    // const dym = d3.mean(refs.current.yd);
                    // console.log(xm, ym, dxm, dym);
                    const xticks = refs.current.mww / heatmap_rect_size;
                    const yticks = refs.current.mwh / heatmap_rect_size;
                    const promise = [];

                    Promise.all(promise).then(_ => {
                      axios.post(API('/heatmap'), {
                        // xstep: 1,
                        // ystep: 1,
                        xstep: Math.ceil(xticks / 2),
                        ystep: Math.ceil(yticks / 2),
                        xstep_rate: (refs.current.xd[1] - refs.current.xd[0]) / xticks,
                        ystep_rate: (refs.current.yd[1] - refs.current.yd[0]) / yticks,
                        proj: getProj(),
                        u: refs.current.datasu[state_hoverInfo.id].u,
                        selection: refs.current.datasu.map(x => x.u)
                      }).then(resp => {

                        new RectNormal(refs, resp.data,
                          [datasu[state_selectedPointInfo.id].x, datasu[state_selectedPointInfo.id].y],
                          Math.abs(refs.current.xfunc(0) - refs.current.xfunc((refs.current.xd[1] - refs.current.xd[0]) / xticks)),
                        );
                      });
                    });

                  }}>
                  <AppsOutageIcon />

                </IconButton>
              </Tooltip>
              <Tooltip title="Clear Heatmap">
                <IconButton color="inherit"
                  onClick={(e) => {
                    // refs.current.heatmap_meta = [];
                    ensureEmptySlot(refs, SLOT_RECT);

                    // renderHeatmap(refs);
                    // renderCircles(refs, 3);
                    new CircleNormal(refs,
                      setState_selectedPointInfo,
                      dispatchSelectedPointInfo,
                      hoverObject,
                      setState_lockRefs,
                    );

                  }}>CH</IconButton>
              </Tooltip>
              <Tooltip title="Toggle Point Label">
                <IconButton color="inherit"
                  onClick={(e) => {
                    if (0 === refs.current.renderSlots[SLOT_TEXT_CIRCLE_LABEL].length) new TextCircleLabel(refs);
                    else ensureEmptySlot(refs, SLOT_TEXT_CIRCLE_LABEL);
                    // renderTextLabels(refs);
                  }}>SW</IconButton>
              </Tooltip>

              <Tooltip title="Show Distance">

                <IconButton color="inherit"
                  disabled={state_selectedPointUniqueID.length !== 2}
                  onClick={(e) => {
                    axios.post(API('/distance'),
                      {
                        proj: getProj(),
                        selection: refs.current.su
                      }
                    ).then(resp => {
                      console.log('distance response:', resp);
                      // 需要一个结构来根据选中两点的u快速找到这个TextDistanceLabel对象
                      if (!refs.current.distanceLabelMap)
                        refs.current.distanceLabelMap = {};
                      // 这里用冒号接两个u
                      TextDistanceLabel.auto(refs, resp.data[0]);

                    });
                  }}>
                  <LinearScaleIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Save Snapshot">
                <IconButton color="inherit"
                  onClick={(e) => {
                    console.log(dumpCommon(refs));
                    axios.post(API('/snapshot'),
                      {
                        proj: getProj(),
                        j: dumpCommon(refs),
                      }
                    ).then(resp => {
                      console.log('create snapshot response:', resp);
                      // 刷新列表
                      getSnapshots();
                    });
                  }}>
                  <SaveIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Save Main view as PNG">
                <IconButton color="inherit"
                  onClick={(e) => {
                    const d3ToPng = require('d3-svg-to-png');
                    d3ToPng('#mainsvg', getProj());
                  }}>
                  <FileDownloadIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Save Second graph as PNG">
                <IconButton color="inherit"
                  onClick={(e) => {
                    const d3ToPng = require('d3-svg-to-png');
                    d3ToPng('#secondsvg', getProj());
                  }}>
                  <FileDownloadIcon />
                </IconButton>
              </Tooltip>

            </Toolbar>
          </AppBar>
          <Box style={{ flex: 200, height: '100%' }} id="main-view">
            <svg id='mainsvg' ref={ref_component} style={{ height: "100%", width: "100%", marginRight: "0px", marginLeft: "0px" }} />
          </Box>
          <Box style={{ flex: 100, height: '100%' }} id="lossgraph-view">
            <svg id='secondsvg' ref={lossgraph_component} style={{ height: "100%", width: "100%", marginRight: "0px", marginLeft: "0px" }} />
          </Box>

        </Box>
      </Stack>
    </Container >
  );
}