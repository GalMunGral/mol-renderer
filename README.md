# Mol Renderer

**Live demo:** https://galmungral.github.io/mol-renderer/

## Rhetorical Design

### Purpose

The spatial arrangement of atoms determines a molecule's properties, and chemistry has notations — wedge-dash bonds, Newman projections, skeletal formulas — for encoding this on paper. All of them require the reader to mentally reconstruct a three-dimensional shape from a coded flat image. That reconstruction is work that a 3D viewer does automatically.

### Strategy

Parse a real molecule from a Tripos Mol2 file and render it as a ball-and-stick model with arcball rotation.

## Technical Challenges

### Bond geometry

Each bond is a pair of cylinders, one per endpoint, colored by element. A cylinder is oriented along $\hat{Y}$ by default. To align it with bond direction $\hat{d} = \widehat{\mathbf{b} - \mathbf{a}}$, the quaternion

```math
q = \cos\tfrac{\theta}{2} + \sin\tfrac{\theta}{2}\,(\hat{Y} \times \hat{d}), \qquad \theta = \arccos(\hat{Y} \cdot \hat{d})
```

encodes a rotation about axis $\hat{Y} \times \hat{d}$. A unit quaternion $q = (w, x, y, z)$ acts on vectors via $\mathbf{v} \mapsto q\mathbf{v}q^{-1}$, equivalent to the rotation matrix

```math
R(q) = \begin{pmatrix} 1-2(y^2+z^2) & 2(xy-wz) & 2(xz+wy) \\ 2(xy+wz) & 1-2(x^2+z^2) & 2(yz-wx) \\ 2(xz-wy) & 2(yz+wx) & 1-2(x^2+y^2) \end{pmatrix}
```

applied to every vertex.

### Draw call consolidation

A molecule with hundreds of atoms and bonds would naively require one draw call per primitive. Instead, all geometries are merged into a single mesh before upload, with per-vertex colors carrying the CPK assignments. The entire molecule renders in one draw call.