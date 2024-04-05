import * as THREE from "three";
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
  return ElementColors[element.toUpperCase()] || 0xdddddd;
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
      let [id, name, x, y, z, type, , , , highlight] = line.split(/\s+/);
      atoms[id] = {
        type,
        x: +x,
        y: +y,
        z: +z,
        highlight: !!highlight,
      };
    } else if (section === "bond") {
      const [id, sId, eId, bType, highlight] = line.split(/\s+/);
      bonds[id] = {
        start: atoms[sId],
        end: atoms[eId],
        highlight: !!highlight,
      };
    }
  }
  return {
    atoms: Object.values(atoms),
    bonds: Object.values(bonds),
  };
}

(async () => {
  const name = new URLSearchParams(location.search).get("name");
  const res = await fetch(name ? `./mol2/${name}.mol2` : "./sample.mol2");
  const { atoms, bonds } = parse(await res.text());

  const BOX_SIZE = 50;

  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity,
    minZ = Infinity,
    maxZ = -Infinity;

  for (let atom of atoms) {
    minX = Math.min(minX, atom.x);
    maxX = Math.max(maxX, atom.x);
    minY = Math.min(minY, atom.y);
    maxY = Math.max(maxY, atom.y);
    minZ = Math.min(minZ, atom.z);
    maxZ = Math.max(maxZ, atom.z);
  }

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const centerZ = (minZ + maxZ) / 2;
  let s = Math.max(maxX - minX, maxY - minY, maxZ - minZ);
  const radius = 8 / s;

  for (let atom of atoms) {
    atom.x = ((atom.x - centerX) / s) * BOX_SIZE;
    atom.y = ((atom.y - centerY) / s) * BOX_SIZE;
    atom.z = ((atom.z - centerZ) / s) * BOX_SIZE;
  }

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xffffff);
  const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );

  const renderer = new THREE.WebGLRenderer();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  document.body.appendChild(renderer.domElement);

  const atomMeshes = atoms.map((atom) => {
    const geometry = new THREE.SphereGeometry(3 * radius).translate(
      atom.x,
      atom.y,
      atom.z
    );
    const material = new THREE.MeshStandardMaterial({
      color: atom.highlight ? 0x00ff00 : colorMap(atom.type),
      roughness: 0.5,
    });
    const mesh = new THREE.Mesh(geometry, material);
    return mesh;
  });

  const bondMeshes = bonds.flatMap((bond) => {
    const start = new THREE.Vector3(bond.start.x, bond.start.y, bond.start.z);
    const end = new THREE.Vector3(bond.end.x, bond.end.y, bond.end.z);
    const center = start.clone().add(end).multiplyScalar(0.5);

    const quaternion = new THREE.Quaternion();
    quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      end.clone().sub(start).normalize()
    );
    quaternion.normalize();

    const geometry1 = new THREE.CylinderGeometry(
      radius,
      radius,
      center.distanceTo(start)
    )
      .applyQuaternion(quaternion)
      .translate(
        (start.x + center.x) / 2,
        (start.y + center.y) / 2,
        (start.z + center.z) / 2
      );

    const highlight =
      bond.highlight || (bond.start.highlight && bond.end.highlight);

    const material1 = new THREE.MeshStandardMaterial({
      color: highlight ? 0x00ff00 : colorMap(bond.start.type),
      roughness: 0.5,
    });
    const mesh1 = new THREE.Mesh(geometry1, material1);

    const geometry2 = new THREE.CylinderGeometry(
      radius,
      radius,
      end.distanceTo(center)
    )
      .applyQuaternion(quaternion)
      .translate(
        (end.x + center.x) / 2,
        (end.y + center.y) / 2,
        (end.z + center.z) / 2
      );

    const material2 = new THREE.MeshStandardMaterial({
      color: highlight ? 0x00ff00 : colorMap(bond.end.type),
      roughness: 0.5,
    });
    const mesh2 = new THREE.Mesh(geometry2, material2);

    return [mesh1, mesh2];
  });

  const meshes: THREE.Mesh[] = [...atomMeshes, ...bondMeshes];

  meshes.forEach((mesh) => scene.add(mesh));

  const AmbientLight = new THREE.AmbientLight(0xffffff, 0.5); // soft white light
  scene.add(AmbientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff);
  scene.add(directionalLight);

  camera.position.z = BOX_SIZE * 1.25;

  let scale = 1;

  window.addEventListener(
    "wheel",
    (e: WheelEvent) => {
      e.preventDefault();
      scale = Math.max(0.1, scale - 0.01 * e.deltaY);
    },
    {
      passive: false,
    }
  );

  let pointerDown = false;
  let prevX = -1;
  let prevY = -1;
  window.addEventListener("pointerdown", (e) => {
    pointerDown = true;
    prevX = e.clientX;
    prevY = e.clientY;
  });
  window.addEventListener("pointerup", () => (pointerDown = false));
  window.addEventListener("pointermove", (e) => {
    if (pointerDown) {
      // const deltaX = e.screenX - prevX;
      // const deltaY = e.screenY - prevY;
      // const axis = new THREE.Vector3(0, 0, 1)
      //   .cross(new THREE.Vector3(deltaX, -deltaY, 0))
      //   .normalize();
      // const angle = 0.01 * Math.sqrt(deltaX ** 2 + deltaY ** 2);
      // meshes.forEach((mesh) => mesh.rotateOnWorldAxis(axis, angle));

      function toDir(x: number, y: number) {
        const rect = renderer.domElement.getBoundingClientRect();
        const z = new THREE.Vector3(0, 0, BOX_SIZE / 4).project(camera).z;
        return new THREE.Vector3(
          ((x - rect.left) / rect.width) * 2 - 1,
          ((rect.bottom - y) / rect.height) * 2 - 1,
          z
        )
          .unproject(camera)
          .normalize();
      }

      const quaternion = new THREE.Quaternion();
      quaternion.setFromUnitVectors(
        toDir(prevX, prevY),
        toDir(e.clientX, e.clientY)
      );
      meshes.forEach((mesh) => mesh.applyQuaternion(quaternion));

      prevX = e.clientX;
      prevY = e.clientY;
    }
  });

  const yAxis = new THREE.Vector3(0, 1, 0);
  function animate() {
    requestAnimationFrame(animate);

    meshes.forEach((mesh) => mesh.scale.set(scale, scale, scale));
    if (!pointerDown) {
      meshes.forEach((mesh) => mesh.rotateOnWorldAxis(yAxis, 0.01));
    }

    renderer.render(scene, camera);
  }

  animate();
})();
