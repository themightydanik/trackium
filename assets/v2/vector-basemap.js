(function (root) {
  'use strict';
  const palette = {
    light: {earth:'#eef1ec', water:'#c6dce8', green:'#dce9d8', industry:'#e7e1db',
      building:'#dfded7', boundary:'#a1a7b1', casing:'#c5c7c8', local:'#fcfbf8',
      major:'#e8cfa8', motorway:'#dcba84', label:'#273743', halo:'#f8f9f5'},
    dark: {earth:'#212b32', water:'#182f40', green:'#293c34', industry:'#3a3439',
      building:'#39434a', boundary:'#6e8192', casing:'#20252c', local:'#4d5a64',
      major:'#777064', motorway:'#9b8265', label:'#e3eaf0', halo:'#202a31'}
  };
  const interpolate = (low, middle, high) => ['interpolate',['linear'],['zoom'],8,low,13,middle,18,high];
  const major = ['in',['get','kind'],['literal',['highway','major_road']]];
  const roadFilter = ['!=',['get','kind'],'path'];
  const motorway = ['==',['get','kind'],'highway'];
  const roadWidth = (scale) => interpolate(...[.65,2,9].map(width =>
    ['case',motorway,width*scale*1.65,major,width*scale*1.2,width*scale*.74]));
  const labelLayout = {'text-font':['NotoSansRegular'],
    'text-field':['coalesce',['get','name'],['get','name:en'],'']};

  function layers(colors) {
    const fill = (id, source, color, filter, minzoom) => ({
      id,type:'fill',source:'roads','source-layer':source,
      ...(filter ? {filter} : {}), ...(minzoom ? {minzoom} : {}), paint:{'fill-color':color}
    });
    const roads = (id, color, width) => ({
      id,type:'line',source:'roads','source-layer':'roads',filter:roadFilter,
      layout:{'line-join':'round','line-cap':'round',
        'line-sort-key':['case',motorway,3,major,2,1]},
      paint:{'line-color':color,'line-width':width}
    });
    const textPaint = {'text-color':colors.label,'text-halo-color':colors.halo,'text-halo-width':1.25};
    return [
      fill('m1-earth','earth',colors.earth),
      fill('m1-parks','landuse',colors.green,['in',['get','kind'],['literal',
        ['park','forest','nature_reserve','recreation_ground','grass','meadow']]]),
      fill('m1-landcover','landcover',colors.green,['in',['get','kind'],['literal',['grassland','forest','wood']]]),
      fill('m1-industrial','landuse',colors.industry,['in',['get','kind'],['literal',
        ['industrial','commercial','port','railway']]]),
      fill('m1-water','water',colors.water,['==',['geometry-type'],'Polygon']),
      {id:'m1-waterway',type:'line',source:'roads','source-layer':'water',
        filter:['==',['geometry-type'],'LineString'],paint:{'line-color':colors.water,'line-width':interpolate(.4,1,3)}},
      fill('m1-building','buildings',colors.building,undefined,13),
      {id:'m1-boundary',type:'line',source:'roads','source-layer':'boundaries',
        paint:{'line-color':colors.boundary,'line-width':1,'line-dasharray':[4,3]}},
      roads('m1-road-casing',colors.casing,roadWidth(1.38)),
      roads('m1-road-fill',['case',motorway,colors.motorway,major,colors.major,colors.local],roadWidth(1)),
      {id:'m1-settlement',type:'symbol',source:'roads','source-layer':'places',
        layout:{...labelLayout,'text-size':['case',['==',['get','kind'],'locality'],15,12],
          'symbol-sort-key':['coalesce',['get','population_rank'],0]},
        paint:textPaint},
      {id:'m1-road-label',type:'symbol',source:'roads','source-layer':'roads',minzoom:12,
        filter:roadFilter,layout:{...labelLayout,'symbol-placement':'line','text-size':11,'symbol-spacing':250},
        paint:textPaint}
    ];
  }

  let dependencies;
  function loadScript(name) {
    return new Promise((resolve,reject) => {
      const script = document.createElement('script');
      script.src = '/app/assets/v2/' + name + '.js';
      script.onload = resolve;
      script.onerror = () => { script.remove(); reject(new Error('Map renderer unavailable')); };
      document.head.append(script);
    });
  }
  function loadRenderer() {
    dependencies ??= (async () => {
      if (!root.maplibregl) await loadScript('maplibre-gl-csp');
      root.maplibregl.setWorkerCount(1);
      root.maplibregl.setWorkerUrl('/app/assets/v2/maplibre-gl-csp-worker.js');
      if (!root.L.maplibreGL) await loadScript('leaflet-maplibre-gl');
      if (!document.getElementById('vector-map-stylesheet')) {
        const css = document.createElement('link');
        css.id = 'vector-map-stylesheet';
        css.rel = 'stylesheet';
        css.href = '/app/assets/v2/maplibre-gl.css';
        document.head.append(css);
      }
    })().catch(error => { dependencies = null; throw error; });
    return dependencies;
  }
  const attribution = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a> · ' +
    '<a href="https://protomaps.com/">Protomaps</a>';

  function create(release, container, theme) {
    const base = '/app/assets/vector-tiles/' + release + '/';
    const L = root.L;
    const layer = L.layerGroup();
    let active = false, vector, GL, timeout, paintedTheme, disposed = false;
    const status = value => { container.dataset.vectorState = value; };
    const fail = () => {
      status('fallback');
      clearTimeout(timeout);
      if (vector && layer.hasLayer(vector)) layer.removeLayer(vector);
      GL = null;
    };
    const updateTheme = () => {
      const nextTheme = theme();
      if (!GL?.getLayer('m1-earth') || nextTheme === paintedTheme) return;
      paintedTheme = nextTheme;
      for (const style of layers(palette[paintedTheme]))
        for (const [key,value] of Object.entries(style.paint))
          GL.setPaintProperty(style.id,key,value);
    };
    layer.on('add', async () => {
      active = true;
      status('loading');
      timeout = setTimeout(() => status('fallback'),6000);
      try {
        await loadRenderer();
        if (!active || disposed || GL) return;
        const probe = document.createElement('canvas');
        const context = probe.getContext('webgl2') || probe.getContext('webgl');
        if (!context) return fail();
        context.getExtension('WEBGL_lose_context')?.loseContext();

        // Only this layer is replaced on basemap toggle or GPU loss.
        const SafeLayer = L.MaplibreGL.extend({
          onRemove(map) {
            if (this.getMaplibreMap()) L.MaplibreGL.prototype.onRemove.call(this,map);
            else this.getContainer()?.remove();
          }
        });
        paintedTheme = theme();
        vector = new SafeLayer({pane:'trackiumVectorRoads',interactive:false,
          attribution,fadeDuration:0,padding:0,renderWorldCopies:false,maxTileCacheSize:48,
          style:{version:8,glyphs:location.origin+base+'glyphs/{fontstack}/{range}.pbf',
            sources:{roads:{type:'vector',tiles:[location.origin+base+'{z}/{x}/{y}.pbf'],minzoom:8,maxzoom:15}},
            layers:layers(palette[paintedTheme])}});
        vector.on('add', () => {
          GL = vector.getMaplibreMap();
          GL.getCanvas().tabIndex = -1;
          GL.on('webglcontextlost',fail);
          GL.on('idle', () => {
            if (!GL) return;
            clearTimeout(timeout);
            updateTheme();
            const roadsVisible = GL.queryRenderedFeatures({layers:['m1-road-fill']}).length;
            status(roadsVisible ? 'ready' : GL.getZoom() < 8 ? 'overview' : 'fallback');
          });
          GL.on('dataloading', () => {
            clearTimeout(timeout);
            timeout = setTimeout(() => status('fallback'),6000);
          });
          // Missing tiles are expected outside the mounted area. The idle handler
          // derives availability from visible road features.
          GL.on('error', () => {});
        });
        layer.addLayer(vector);
      } catch {
        fail();
      }
    });
    layer.on('remove', () => {
      active = false;
      clearTimeout(timeout);
      if (vector) layer.removeLayer(vector);
      GL = null;
      status('hidden');
    });
    return {
      layer,
      updateTheme,
      dispose() { disposed = true; clearTimeout(timeout); }
    };
  }
  root.TrackiumVectorBasemap = {create};
})(window);
