const fs = require('node:fs');
const vm = require('node:vm');
function ringContains(ring,x,y){let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const [xi,yi]=ring[i],[xj,yj]=ring[j];if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)inside=!inside;}return inside;}
function contains(f,s){const polys=f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates;return polys.some(p=>ringContains(p[0],s.lon,s.lat)&&!p.slice(1).some(r=>ringContains(r,s.lon,s.lat)));}
function distanceToMunicipality(f,s){if(contains(f,s))return 0;const polys=f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates;let best=Infinity;const kx=111.2*Math.cos(s.lat*Math.PI/180),ky=111.2;for(const p of polys)for(const ring of p)for(let i=1;i<ring.length;i++){const a=[(ring[i-1][0]-s.lon)*kx,(ring[i-1][1]-s.lat)*ky],b=[(ring[i][0]-s.lon)*kx,(ring[i][1]-s.lat)*ky],d=[b[0]-a[0],b[1]-a[1]],t=Math.max(0,Math.min(1,-(a[0]*d[0]+a[1]*d[1])/(d[0]**2+d[1]**2||1)));best=Math.min(best,Math.hypot(a[0]+t*d[0],a[1]+t*d[1]));}return Math.round(best*10)/10;}
function loadStationInputs(gaugePath, geographyPath) {
  const ctx = {window: {}};
  vm.createContext(ctx);
  for (const file of [gaugePath, geographyPath]) {
    vm.runInContext(fs.readFileSync(file, 'utf8'), ctx);
  }
  return {events: ctx.window.GAUGE_DATA.events, geo: ctx.window.RAIN_GEOGRAPHY.features};
}

module.exports = {loadStationInputs, contains, distanceToMunicipality};
