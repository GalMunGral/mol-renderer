# Mol Renderer

**Live demo:** https://galmungral.github.io/mol-renderer/

## Rhetorical Design

### Purpose

The spatial arrangement of atoms in a molecule determines its properties, and chemistry has developed notations — wedge-dash bonds, Newman projections, skeletal formulas — for encoding this on paper. All of them require the reader to mentally reconstruct a three-dimensional shape from a coded flat image. The intuition you get from rotating an actual 3D model is not accessible through any two-dimensional medium: what is concrete on screen can only be imagined on paper.

### Strategy

Parse a real molecule from a Tripos Mol2 file and render it as a ball-and-stick model with shadow mapping and trackball rotation. The choice of mol2 as input format means the renderer works with actual crystallographic data rather than constructed examples.

## Technical Challenges

### Bond geometry

Each bond is rendered as a pair of cylinders, one per endpoint, each colored by its element. A `CylinderGeometry` is oriented along $\hat{Y}$ by default. To align it with a bond direction $\hat{d} = \widehat{\mathbf{b} - \mathbf{a}}$, the quaternion

```math
q = \cos\tfrac{\theta}{2} + \sin\tfrac{\theta}{2}\,(\hat{Y} \times \hat{d})
```

encodes a rotation by $\theta = \arccos(\hat{Y} \cdot \hat{d})$ about the axis $\hat{Y} \times \hat{d}$. A unit quaternion $q = (w, x, y, z)$ acts on vectors via $\mathbf{v} \mapsto q\mathbf{v}q^{-1}$, which is equivalent to applying the rotation matrix

```math
R(q) = \begin{pmatrix} 1-2(y^2+z^2) & 2(xy-wz) & 2(xz+wy) \\ 2(xy+wz) & 1-2(x^2+z^2) & 2(yz-wx) \\ 2(xz-wy) & 2(yz+wx) & 1-2(x^2+y^2) \end{pmatrix}
```

to every vertex of the geometry.