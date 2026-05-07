import * as THREE from "three";
import { ArcballControls } from "three/addons/controls/ArcballControls.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { ElementColors } from "./colorMap.js";

interface Atom {
  x: number;
  y: number;
  z: number;
  type: string;
  highlight: boolean;
}

interface Bond {
  start: Atom;
  end: Atom;
  highlight: boolean;
}

function colorMap(aType: string) {
  const element = aType.split(".")[0];
  return ElementColors[element.toUpperCase()] || 0xd0d0d0;
}

function parse(mol2Src: string): { atoms: Atom[]; bonds: Bond[] } {
  const atoms: Record<string, Atom> = {};
  const bonds: Record<string, Bond> = {};
  const lines = mol2Src.split("\n").map((line) => line.trim());
  let section: "atom" | "bond" | "other" = "other";
  for (let line of lines) {
    if (!line) continue;
    if (line === "@<TRIPOS>ATOM") {
      section = "atom";
    } else if (line === "@<TRIPOS>BOND") {
      section = "bond";
    } else if (line.startsWith("@")) {
      section = "other";
    } else if (section === "atom") {
      let [id, , x, y, z, type, , , , highlight] = line.split(/\s+/);
      atoms[id] = { type, x: +x, y: +y, z: +z, highlight: !!highlight };
    } else if (section === "bond") {
      const [id, sId, eId, , highlight] = line.split(/\s+/);
      bonds[id] = { start: atoms[sId], end: atoms[eId], highlight: !!highlight };
    }
  }
  return { atoms: Object.values(atoms), bonds: Object.values(bonds) };
}

function withColor(geometry: THREE.BufferGeometry, hex: number) {
  const color = new THREE.Color(hex);
  const count = geometry.attributes.position.count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return geometry;
}

(async () => {
  const name = new URLSearchParams(location.search).get("name");
  const res = await fetch(name ? `./${name}.mol2` : "./1et4.mol2");
  const { atoms, bonds } = parse(await res.text());

  const BOX_SIZE = 50;

  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;
  let s = 0;

  for (let atom of atoms) {
    minX = Math.min(minX, atom.x); maxX = Math.max(maxX, atom.x);
    minY = Math.min(minY, atom.y); maxY = Math.max(maxY, atom.y);
    minZ = Math.min(minZ, atom.z); maxZ = Math.max(maxZ, atom.z);
    s = Math.max(s, Math.sqrt(atom.x ** 2 + atom.y ** 2 + atom.z ** 2));
  }

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const centerZ = (minZ + maxZ) / 2;
  const radius = 20 / s;

  for (let atom of atoms) {
    atom.x = ((atom.x - centerX) / s) * BOX_SIZE;
    atom.y = ((atom.y - centerY) / s) * BOX_SIZE;
    atom.z = ((atom.z - centerZ) / s) * BOX_SIZE;
  }

  const geometries: THREE.BufferGeometry[] = [];

  for (const atom of atoms) {
    const hex = atom.highlight ? 0x00ff00 : colorMap(atom.type);
    geometries.push(
      withColor(
        new THREE.SphereGeometry(radius, 8, 6).translate(atom.x, atom.y, atom.z),
        hex
      )
    );
  }

  for (const bond of bonds) {
    const start = new THREE.Vector3(bond.start.x, bond.start.y, bond.start.z);
    const end = new THREE.Vector3(bond.end.x, bond.end.y, bond.end.z);
    const center = start.clone().add(end).multiplyScalar(0.5);
    const highlight = bond.highlight || (bond.start.highlight && bond.end.highlight);

    const quaternion = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      end.clone().sub(start).normalize()
    );

    geometries.push(
      withColor(
        new THREE.CylinderGeometry(radius * 0.4, radius * 0.4, center.distanceTo(start), 6)
          .applyQuaternion(quaternion)
          .translate(
            (start.x + center.x) / 2,
            (start.y + center.y) / 2,
            (start.z + center.z) / 2
          ),
        highlight ? 0x00ff00 : colorMap(bond.start.type)
      )
    );

    geometries.push(
      withColor(
        new THREE.CylinderGeometry(radius * 0.4, radius * 0.4, end.distanceTo(center), 6)
          .applyQuaternion(quaternion)
          .translate(
            (end.x + center.x) / 2,
            (end.y + center.y) / 2,
            (end.z + center.z) / 2
          ),
        highlight ? 0x00ff00 : colorMap(bond.end.type)
      )
    );
  }

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1a1a);

  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5 });
  const mesh = new THREE.Mesh(mergeGeometries(geometries), material);
  scene.add(mesh);

  const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.set(0, -0.5 * BOX_SIZE, 0);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  document.body.appendChild(renderer.domElement);

  const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
  scene.add(ambientLight);

  const pointLight = new THREE.PointLight(0xffffff, 2, 1000, 0);
  pointLight.position.set(2 * BOX_SIZE, -2 * BOX_SIZE, 2 * BOX_SIZE);
  scene.add(pointLight);

  new ArcballControls(camera, renderer.domElement, scene);

  const btnWireframe = document.getElementById("btn-wireframe")!;
  btnWireframe.addEventListener("click", () => {
    material.wireframe = !material.wireframe;
    btnWireframe.classList.toggle("active", material.wireframe);
  });

  function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
  }

  animate();
})();