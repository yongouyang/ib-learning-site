import { Topic } from './types';

const mathDPVectors: Topic = {
  id: 'math-dp-vectors',
  subjectId: 'math',
  title: 'Vectors',
  description: 'Vector notation, magnitude, unit vectors, scalar product, angle between vectors, vector equation of a line, and classifying lines in 3D.',
  ibLevel: 'DP',
  notes: [
    { id: 'vec-n1', heading: 'Vector Notation and Basic Operations', body: `Vectors describe quantities that have both size and direction.

Scalars like speed or mass only have magnitude. Vectors like velocity or force also tell you which way something is pointing.

📌 Definition
A vector in 3D has three components. It can be written as a column vector or using base vectors $\mathbf{i}$, $\mathbf{j}$ and $\mathbf{k}$.
    $$\vec{v} = \begin{pmatrix} v_1 \\ v_2 \\ v_3 \end{pmatrix} \quad \text{or} \quad \vec{v} = v_1\mathbf{i} + v_2\mathbf{j} + v_3\mathbf{k}$$
    where $v_1, v_2, v_3$ are the displacements in the $x$, $y$ and $z$ directions.

🔑 Magnitude
The length of a vector is found using Pythagoras in 3D.
    $$|\vec{v}| = \sqrt{v_1^2 + v_2^2 + v_3^2}$$

💡 Worked Example — Magnitude & Unit Vector
Find the magnitude of $\vec{v} = (2, -3, 6)$ and the unit vector in the same direction.

  Step 1: Calculate the magnitude
    $$|\vec{v}| = \sqrt{2^2 + (-3)^2 + 6^2}$$
    $$|\vec{v}| = \sqrt{4 + 9 + 36}$$
    $$|\vec{v}| = \sqrt{49} = 7$$

  Step 2: Divide each component by the magnitude
    $$\hat{v} = \left(\frac{2}{7}, -\frac{3}{7}, \frac{6}{7}\right)$$

🔑 Unit Vector
A unit vector has magnitude 1 and points in the same direction as the original.
    $$\hat{v} = \frac{\vec{v}}{|\vec{v}|}$$

🔑 Vector Operations
• Addition:     $$\vec{a} + \vec{b} = (a_1 + b_1, a_2 + b_2, a_3 + b_3)$$
• Subtraction:  $$\vec{a} - \vec{b} = (a_1 - b_1, a_2 - b_2, a_3 - b_3)$$
• Scalar multiplication:  $$k\vec{a} = (ka_1, ka_2, ka_3)$$

💡 Worked Example — Vector AB & Midpoint
Given $A(1, 3, 2)$ and $B(5, 1, 4)$, find vector $\overrightarrow{AB}$ and the midpoint $M$.

  Step 1: Write the position vectors
    $$\vec{a} = (1, 3, 2) \quad \vec{b} = (5, 1, 4)$$

  Step 2: Subtract to find $\overrightarrow{AB}$
    $$\overrightarrow{AB} = \vec{b} - \vec{a} = (5-1, 1-3, 4-2) = (4, -2, 2)$$

  Step 3: Use the midpoint formula
    $$\vec{M} = \frac{\vec{a} + \vec{b}}{2}$$
    $$\vec{M} = \left(\frac{1+5}{2}, \frac{3+1}{2}, \frac{2+4}{2}\right) = (3, 2, 3)$$

🔑 Position Vectors & Key Formulas
• Position vector of point $P$:   $$\overrightarrow{OP} = \vec{p}$$
• Vector from $A$ to $B$:           $$\overrightarrow{AB} = \vec{b} - \vec{a}$$
• Midpoint of $AB$:               $$\vec{M} = \frac{\vec{a} + \vec{b}}{2}$$
• Section formula — dividing $AB$ in the ratio $m : n$ from $A$:
    $$\vec{P} = \frac{n\vec{a} + m\vec{b}}{m + n}$$

📎 Key Points to Remember
• Column vectors list $x$, then $y$, then $z$ from top to bottom.
• $\mathbf{i}$, $\mathbf{j}$, $\mathbf{k}$ are unit vectors along the positive $x$, $y$, $z$ axes.
• Multiplying by a negative scalar reverses the direction but keeps the line of action.

⚠️ Common Mistake
Mixing up the order in the section formula. When the ratio $m : n$ is measured from $A$, the point is closer to $A$ when $m$ is small. The formula pairs $\vec{a}$ with $n$ and $\vec{b}$ with $m$:
    $$\vec{P} = \frac{n\vec{a} + m\vec{b}}{m + n}$$` },
    { id: 'vec-n2', heading: 'Scalar (Dot) Product', body: `The scalar product turns two vectors into a single number. That number reveals how much the vectors point in the same direction.

📌 Definition
For vectors $\vec{a} = (a_1, a_2, a_3)$ and $\vec{b} = (b_1, b_2, b_3)$:
    $$\vec{a} \cdot \vec{b} = a_1b_1 + a_2b_2 + a_3b_3$$

🔑 Geometric Formula
The scalar product also equals the product of the magnitudes times the cosine of the angle between them.
    $$\vec{a} \cdot \vec{b} = |\vec{a}| |\vec{b}| \cos \theta$$
    where $\theta$ is the angle between the vectors placed tail-to-tail.

💡 Worked Example — Finding the Angle
Find the angle between $\vec{a} = (1, 1, 0)$ and $\vec{b} = (0, 1, 1)$.

  Step 1: Calculate the scalar product
    $$\vec{a} \cdot \vec{b} = (1)(0) + (1)(1) + (0)(1) = 1$$

  Step 2: Find the magnitudes
    $$|\vec{a}| = \sqrt{1^2 + 1^2 + 0^2} = \sqrt{2}$$
    $$|\vec{b}| = \sqrt{0^2 + 1^2 + 1^2} = \sqrt{2}$$

  Step 3: Use the geometric formula
    $$\cos \theta = \frac{\vec{a} \cdot \vec{b}}{|\vec{a}| |\vec{b}|} = \frac{1}{\sqrt{2} \times \sqrt{2}} = \frac{1}{2}$$

  Step 4: Find the angle
    $$\theta = \cos^{-1}\left(\frac{1}{2}\right) = 60^\circ$$

🔑 Perpendicular Test
Two non-zero vectors are perpendicular exactly when their scalar product is zero.
    $$\vec{a} \cdot \vec{b} = 0 \iff \vec{a} \perp \vec{b}$$

💡 Worked Example — Finding a Missing Component
Find $t$ so that $\vec{v} = (2, t, 5)$ and $\vec{w} = (t - 1, -1, 1)$ are perpendicular.

  Step 1: Set the scalar product equal to zero
    $$\vec{v} \cdot \vec{w} = 2(t - 1) + t(-1) + 5(1) = 0$$

  Step 2: Expand and simplify
    $$2t - 2 - t + 5 = 0$$
    $$t + 3 = 0$$

  Step 3: Solve
    $$t = -3$$

🔑 Scalar Projection
The scalar projection of $\vec{a}$ onto $\vec{b}$ is the "shadow" that $\vec{a}$ casts on $\vec{b}$.
    $$\operatorname{comp}_{\vec{b}}(\vec{a}) = \frac{\vec{a} \cdot \vec{b}}{|\vec{b}|}$$

📎 Key Points to Remember
• The result of a dot product is a scalar, never a vector.
• $\vec{a} \cdot \vec{a} = |\vec{a}|^2$.
• $\vec{a} \cdot \vec{b} > 0$ means the angle is acute; $\vec{a} \cdot \vec{b} < 0$ means it is obtuse.

⚠️ Common Mistake
Trying to use the dot product to find a perpendicular vector. The dot product only gives a number. To produce a perpendicular vector you need the cross product.` },
    { id: 'vec-n3', heading: 'Vector Equation of a Line', body: `A straight line in 2D or 3D is fully described by one point on the line and a direction to travel along it.

📌 Definition
The vector equation of a line passes through a point with position vector $\vec{a}$ and runs parallel to direction vector $\vec{b}$.

🔑 Vector Form
    $$\vec{r} = \vec{a} + \lambda \vec{b}$$
    where:
    • $\vec{r}$ is the position vector of any point on the line
    • $\vec{a}$ is the position vector of a known point
    • $\vec{b}$ is the direction vector
    • $\lambda$ is a real parameter

🔑 Parametric Form
Splitting into components gives three equations:
    $$x = a_1 + \lambda b_1$$
    $$y = a_2 + \lambda b_2$$
    $$z = a_3 + \lambda b_3$$

🔑 Cartesian Form
If every direction component is non-zero, eliminate $\lambda$:
    $$\frac{x - a_1}{b_1} = \frac{y - a_2}{b_2} = \frac{z - a_3}{b_3}$$

💡 Worked Example — Equation Through Two Points
Find a vector equation of the line through $A(4, 0, -5)$ and $B(3, 0, -3)$.

  Step 1: Choose a point on the line
    $$\vec{a} = (4, 0, -5)$$

  Step 2: Find the direction vector $\overrightarrow{AB}$
    $$\vec{b} = \vec{B} - \vec{A} = (3-4, 0-0, -3-(-5)) = (-1, 0, 2)$$

  Step 3: Write the vector equation
    $$\vec{r} = (4, 0, -5) + \lambda(-1, 0, 2)$$

💡 Worked Example — Does a Point Lie on the Line?
Determine whether $C(2, 0, -1)$ lies on the line $\vec{r} = (4, 0, -5) + \lambda(-1, 0, 2)$.

  Step 1: Set up the component equations
    $$2 = 4 - \lambda$$
    $$0 = 0 + 0\lambda$$
    $$-1 = -5 + 2\lambda$$

  Step 2: Solve the first equation
    $$\lambda = 2$$

  Step 3: Check the other equations
    $$0 = 0 \quad \checkmark$$
    $$-5 + 2(2) = -1 \quad \checkmark$$

Since the same $\lambda = 2$ satisfies all three equations, $C$ lies on the line.

📎 Key Points to Remember
• Any scalar multiple of the direction vector represents the same line.
• A line has infinitely many valid vector equations because any point on it can be used for $\vec{a}$.
• To test a point, solve for $\lambda$ in one component and verify it works in the rest.

⚠️ Common Mistake
Using the same parameter letter for two different lines. When looking for an intersection, use different parameters such as $\lambda$ and $\mu$ so you do not accidentally force the points to match.` },
    { id: 'vec-n4', heading: 'Line Classification in 3D', body: `In two dimensions, lines either meet or are parallel. In three dimensions there is a third possibility: they can miss each other without being parallel.

📌 Definitions
• Parallel — direction vectors are scalar multiples of each other.
• Intersecting — the lines share exactly one point.
• Skew — not parallel and do not intersect (unique to 3D and above).

🔑 Parallel Test
Two lines with direction vectors $\vec{b}_1$ and $\vec{b}_2$ are parallel when:
    $$\vec{b}_1 = k\vec{b}_2 \quad \text{for some scalar } k$$

🔑 Intersection Test
Write both lines in parametric form using different parameters ($\lambda$ and $\mu$). Solve the three component equations. If one pair $(\lambda, \mu)$ satisfies all three, the lines meet at that point.

🔑 Skew Test
If the direction vectors are not parallel, attempt the intersection test. If the system of equations has no solution, the lines are skew.

💡 Worked Example — Classify Two Lines
Line $L_1$: $\vec{r} = (1, 0, 0) + \lambda(0, 1, 0)$
Line $L_2$: $\vec{r} = (0, 0, 1) + \mu(1, 0, 0)$

  Step 1: Check for parallelism
    $(0, 1, 0)$ is not a scalar multiple of $(1, 0, 0)$.
    The lines are not parallel.

  Step 2: Set the parametric components equal
    $$1 = 0 + \mu \quad \Rightarrow \quad \mu = 1$$
    $$0 + \lambda = 0 \quad \Rightarrow \quad \lambda = 0$$
    $$0 = 1 + 0 \quad \Rightarrow \quad 0 = 1 \quad \times$$

  Step 3: Interpret the result
    The third equation is impossible, so there is no intersection.

Conclusion: $L_1$ and $L_2$ are skew.

📎 Key Points to Remember
• Skew lines exist only when there are at least three dimensions.
• Coincident lines are parallel lines that lie on top of each other.
• Always check parallelism first — it is the fastest test.

⚠️ Common Mistake
Assuming that non-parallel lines in 3D must intersect. Most non-parallel lines in 3D are skew. You must solve the equations to be certain.` },
    { id: 'vec-n5', heading: 'Vector (Cross) Product and Geometric Applications', body: `The cross product multiplies two vectors to produce a third vector that is perpendicular to both. It is the key to finding areas and shortest distances in 3D.

📌 Definition
For $\vec{a} = (a_1, a_2, a_3)$ and $\vec{b} = (b_1, b_2, b_3)$:
    $$\vec{a} \times \vec{b} = (a_2b_3 - a_3b_2, \; a_3b_1 - a_1b_3, \; a_1b_2 - a_2b_1)$$

🔑 Magnitude of the Cross Product
    $$|\vec{a} \times \vec{b}| = |\vec{a}| |\vec{b}| \sin \theta$$
    where $\theta$ is the angle between the vectors.

💡 Worked Example — Triangle Area
Find the area of the triangle with vertices $A(1, 0, 0)$, $B(3, 1, 2)$ and $C(2, -1, 4)$.

  Step 1: Form two side vectors
    $$\overrightarrow{AB} = \vec{B} - \vec{A} = (2, 1, 2)$$
    $$\overrightarrow{AC} = \vec{C} - \vec{A} = (1, -1, 4)$$

  Step 2: Compute the cross product $\overrightarrow{AB} \times \overrightarrow{AC}$
    $$= ((1)(4) - (2)(-1), \; (2)(1) - (2)(4), \; (2)(-1) - (1)(1))$$
    $$= (4 + 2, \; 2 - 8, \; -2 - 1)$$
    $$= (6, -6, -3)$$

  Step 3: Find the magnitude
    $$|\overrightarrow{AB} \times \overrightarrow{AC}| = \sqrt{6^2 + (-6)^2 + (-3)^2} = \sqrt{81} = 9$$

  Step 4: Halve it for the triangle
    $$\text{Area} = \frac{1}{2} \times 9 = \frac{9}{2}$$

🔑 Area Formulas
• Parallelogram with adjacent sides $\vec{a}$ and $\vec{b}$:
    $$\text{Area} = |\vec{a} \times \vec{b}|$$
• Triangle with two sides $\vec{a}$ and $\vec{b}$:
    $$\text{Area} = \frac{1}{2} |\vec{a} \times \vec{b}|$$

🔑 Shortest Distance from a Point to a Line
For a line $\vec{r} = \vec{a} + \lambda \vec{b}$ and a point $P$ not on the line, choose any point $A$ on the line and form vector $\overrightarrow{AP}$.
    $$d = \frac{|\overrightarrow{AP} \times \vec{b}|}{|\vec{b}|}$$

💡 Worked Example — Shortest Distance
Find the shortest distance from $P(3, 1, -2)$ to the line $\vec{r} = (1, 0, 1) + \lambda(2, -1, 2)$.

  Step 1: Choose $A$ on the line and find $\overrightarrow{AP}$
    $$\vec{A} = (1, 0, 1)$$
    $$\overrightarrow{AP} = \vec{P} - \vec{A} = (2, 1, -3)$$

  Step 2: Compute $\overrightarrow{AP} \times \vec{b}$
    $$= ((1)(2) - (-3)(-1), \; (-3)(2) - (2)(2), \; (2)(-1) - (1)(2))$$
    $$= (2 - 3, \; -6 - 4, \; -2 - 2)$$
    $$= (-1, -10, -4)$$

  Step 3: Find the magnitudes
    $$|\overrightarrow{AP} \times \vec{b}| = \sqrt{(-1)^2 + (-10)^2 + (-4)^2} = \sqrt{117}$$
    $$|\vec{b}| = \sqrt{2^2 + (-1)^2 + 2^2} = 3$$

  Step 4: Divide
    $$d = \frac{\sqrt{117}}{3} = \sqrt{13}$$

📎 Key Points to Remember
• $\vec{a} \times \vec{b}$ is perpendicular to both $\vec{a}$ and $\vec{b}$. The right-hand rule gives the direction.
• $\vec{a} \times \vec{b} = -(\vec{b} \times \vec{a})$. Reversing the order flips the sign of every component.
• If $\vec{a} \times \vec{b} = \vec{0}$ (and neither vector is zero), the vectors are parallel.

⚠️ Common Mistake
Using the dot product instead of the cross product when finding area. Area depends on $\sin \theta$, which comes from the cross product, not $\cos \theta$.` },
    { id: 'vec-n6', heading: 'Shortest Distance Between Moving Objects', body: `When two objects move with constant velocity, their paths are straight lines. You can use vectors to find the time at which they are closest together and what that shortest distance is.

📌 Setup
Let the position vectors of two objects at time $t$ be:
    $$\vec{r}_A = \vec{a} + t\vec{v}_A$$
    $$\vec{r}_B = \vec{b} + t\vec{v}_B$$
    where $\vec{a}$, $\vec{b}$ are initial positions and $\vec{v}_A$, $\vec{v}_B$ are constant velocity vectors.

The vector joining them at time $t$ is:
    $$\overrightarrow{AB} = \vec{r}_B - \vec{r}_A = (\vec{b} - \vec{a}) + t(\vec{v}_B - \vec{v}_A)$$

The distance between them is $|\overrightarrow{AB}|$. To avoid square roots, minimise $|\overrightarrow{AB}|^2$.

💡 Worked Example — Closest Approach of Two Ships
Ship A starts at $(0, 0)$ with velocity $(3, 4)$ km/h.
Ship B starts at $(10, 0)$ with velocity $(0, 5)$ km/h.
Find the time when they are closest and the shortest distance.

  Step 1: Write position vectors at time $t$
    $$\vec{r}_A = (0, 0) + t(3, 4) = (3t, 4t)$$
    $$\vec{r}_B = (10, 0) + t(0, 5) = (10, 5t)$$

  Step 2: Find the displacement vector from $A$ to $B$
    $$\overrightarrow{AB} = \vec{r}_B - \vec{r}_A = (10 - 3t, 5t - 4t) = (10 - 3t, t)$$

  Step 3: Form an expression for the squared distance
    $$|\overrightarrow{AB}|^2 = (10 - 3t)^2 + t^2$$
    $$|\overrightarrow{AB}|^2 = 100 - 60t + 9t^2 + t^2$$
    $$|\overrightarrow{AB}|^2 = 10t^2 - 60t + 100$$

  Step 4: Differentiate with respect to $t$ and set to zero
    $$\frac{d}{dt}\left(|\overrightarrow{AB}|^2\right) = 20t - 60 = 0$$
    $$t = 3$$

  Step 5: Find the minimum distance
    $$|\overrightarrow{AB}|^2 \text{ at } t = 3: \; 10(9) - 60(3) + 100 = 90 - 180 + 100 = 10$$
    $$\text{Shortest distance} = \sqrt{10} \text{ km}$$

🔑 Alternative Method (Calculus-free)
If you prefer not to differentiate, complete the square on the quadratic in $t$:
    $$|\overrightarrow{AB}|^2 = 10(t^2 - 6t) + 100$$
    $$|\overrightarrow{AB}|^2 = 10(t - 3)^2 + 10$$
The minimum occurs at $t = 3$ and equals $\sqrt{10}$ km.

📎 Key Points to Remember
• Always minimise the squared distance — it avoids awkward square-root algebra.
• The method works in both 2D and 3D.
• If the objects are on a collision course, the minimum distance is zero.

⚠️ Common Mistake
Differentiating the distance $|\overrightarrow{AB}|$ directly instead of $|\overrightarrow{AB}|^2$. This creates a messy chain-rule expression and is much harder to solve. Squaring first keeps everything simple.` },
  ],
  flashcards: [
    { id: 'vec-f1', term: 'Magnitude', definition: '$|v| = \\sqrt{v_1^2+v_2^2+v_3^2}$', example: '$(2,-3,6)$: $\\sqrt{4+9+36}=7$.' },
    { id: 'vec-f2', term: 'Unit Vector', definition: '$\\hat{v} = \\frac{v}{|v|}$; magnitude 1.', example: '$(3,4)$: $|v|=5$, $\\hat{v}=\\left(\\frac{3}{5},\\frac{4}{5}\\right)$.' },
    { id: 'vec-f3', term: 'Scalar Product', definition: '$a\\cdot b = a_1b_1+a_2b_2+a_3b_3 = |a||b|\\cos\\theta$', example: '$(1,2,3)\\cdot(4,-1,2)=4-2+6=8$.' },
    { id: 'vec-f4', term: 'Perpendicular test', definition: '$a\\cdot b = 0 \\Rightarrow a\\perp b$', example: '$(2,3)\\cdot(3,-2)=6-6=0$.' },
    { id: 'vec-f5', term: 'Vector equation of line', definition: '$r = a + \\lambda b$', example: 'Through $(1,2,3)$, direction $(2,-1,4)$.' },
    { id: 'vec-f6', term: 'Skew lines', definition: '3D lines that are neither parallel nor intersecting.', example: '$L_1$: $r=(1,0,0)+\\lambda(0,1,0)$; $L_2$: $r=(0,0,1)+\\mu(1,0,0)$ are skew.' },
    { id: 'vec-f7', term: 'Parallel vectors', definition: 'Two vectors are parallel if one is a scalar multiple of the other.', example: '$(2,-1,4)$ and $(6,-3,12)$ are parallel because $(6,-3,12)=3(2,-1,4)$.' },
    { id: 'vec-f8', term: 'Cross product magnitude', definition: '$|a\\times b| = |a||b|\\sin\\theta$', example: '$|a|=3$, $|b|=4$, $\\theta=90^\\circ$ $\\Rightarrow$ $|a\\times b|=12$.' },
    { id: 'vec-f9', term: 'Shortest distance from point to line', definition: '$d = \\frac{|AP\\times b|}{|b|}$ where $A$ is on the line and $b$ is the direction vector.', example: '$P(3,1,-2)$, line $r=(1,0,1)+\\lambda(2,-1,2)$ $\\Rightarrow$ $d=\\sqrt{13}$.' },
    { id: 'vec-f10', term: 'Area with cross product', definition: 'Parallelogram area $= |a\\times b|$; triangle area $= \\frac{1}{2}|a\\times b|$.', example: 'Triangle with adjacent sides $a=(2,1,2)$, $b=(1,-1,4)$ has area $\\frac{9}{2}$.' },
  ],
  questions: [
    { id: 'vec-q1', stem: '$|v|$ where $v=(2,-3,6)$?', choices: ['$5$', '$7$', '$\\sqrt{11}$', '$49$'], correctIndex: 1, explanation: '$\\sqrt{4+9+36}=\\sqrt{49}=7$.' },
    { id: 'vec-q2', stem: '$a=(1,2,-1)$, $b=(3,0,2)$. $a\\cdot b=?$', choices: ['$5$', '$1$', '$3$', '$7$'], correctIndex: 1, explanation: '$3+0-2=1$.' },
    { id: 'vec-q3', stem: 'Which pair is perpendicular?', choices: ['$(1,2)$ and $(4,2)$', '$(3,-4)$ and $(4,3)$', '$(2,1)$ and $(1,2)$', '$(5,2)$ and $(2,5)$'], correctIndex: 1, explanation: '$12-12=0$ $\\Rightarrow$ perpendicular.' },
    { id: 'vec-q4', stem: 'Angle between $(1,1,0)$ and $(0,1,1)$?', choices: ['$30^\\circ$', '$45^\\circ$', '$60^\\circ$', '$90^\\circ$'], correctIndex: 2, explanation: '$\\cos\\theta=\\frac{1}{\\sqrt{2}\\cdot\\sqrt{2}}=\\frac{1}{2}$ $\\Rightarrow$ $\\theta=60^\\circ$.' },
    { id: 'vec-q5', stem: 'Midpoint of $A(1,3,2)$ and $B(5,1,4)$?', choices: ['$(3,2,3)$', '$(4,-2,2)$', '$(6,4,6)$', '$(2,4,1)$'], correctIndex: 0, explanation: '$\\left(\\frac{1+5}{2}, \\frac{3+1}{2}, \\frac{2+4}{2}\\right) = (3,2,3)$.' },
    { id: 'vec-q6', stem: '$|a|=3$, $|b|=4$, $\\angle 60^\\circ$. $a\\cdot b=?$', choices: ['$6$', '$12$', '$12\\sqrt{3}$', '$6\\sqrt{3}$'], correctIndex: 0, explanation: '$3\\times 4\\times \\cos 60^\\circ = 12\\times 0.5 = 6$.' },
    { id: 'vec-q7', stem: 'Which operation on two vectors produces another vector?', choices: ['Dot product', 'Scalar product', 'Cross product', 'Scalar projection'], correctIndex: 2, explanation: 'The dot product (also called scalar product) and scalar projection both produce scalars. Only the cross product produces a vector perpendicular to both inputs.' },
    { id: 'vec-q8', stem: '$v=(2,-1,4)$ and $w=(6,k,12)$. Find $k$ so that $v$ and $w$ are parallel.', choices: ['$-2$', '$-3$', '$3$', '$4$'], correctIndex: 1, explanation: 'Parallel vectors are scalar multiples. $6\\div 2=3$ and $12\\div 4=3$, so $w=3v$. Thus $k=3\\times(-1)=-3$.' },
    { id: 'vec-q9', stem: 'What is the shortest distance from $P(3,1,-2)$ to the line $r=(1,0,1)+\\lambda(2,-1,2)$?', choices: ['$\\sqrt{13}$', '$\\sqrt{117}$', '$3$', '$\\frac{\\sqrt{13}}{3}$'], correctIndex: 0, explanation: '$A=(1,0,1)$ is on the line, $\\overrightarrow{AP}=(2,1,-3)$. $\\overrightarrow{AP}\\times b=(-1,-10,-4)$ with magnitude $\\sqrt{117}$. $|b|=\\sqrt{4+1+4}=3$. Distance $= \\frac{\\sqrt{117}}{3} = \\sqrt{13}$.' },
    { id: 'vec-q10', stem: 'Triangle with vertices $A(1,0,0)$, $B(3,1,2)$, $C(2,-1,4)$. What is its area?', choices: ['$\\frac{9}{2}$', '$9$', '$\\sqrt{81}$', '$\\frac{81}{2}$'], correctIndex: 0, explanation: '$\\overrightarrow{AB}=(2,1,2)$, $\\overrightarrow{AC}=(1,-1,4)$. $\\overrightarrow{AB}\\times\\overrightarrow{AC}=(6,-6,-3)$, magnitude $9$. Triangle area $= \\frac{1}{2}\\times 9 = \\frac{9}{2}$.' },
    { id: 'vec-q11', stem: 'Ship A starts at $(0,0)$ with velocity $(3,4)$ km/h. Ship B starts at $(10,0)$ with velocity $(0,5)$ km/h. After how many hours are they closest?', choices: ['$t=2$', '$t=3$', '$t=4$', '$t=5$'], correctIndex: 1, explanation: 'At time $t$, $\\overrightarrow{AB}=(10-3t, t)$. $|\\overrightarrow{AB}|^2=(10-3t)^2+t^2=10t^2-60t+100$. Differentiate: $20t-60=0$ $\\Rightarrow$ $t=3$. At $t=3$ the distance is $\\sqrt{10}$, the minimum.' },
    { id: 'vec-q12', stem: 'Two lines in 3D have direction vectors $d_1=(2,1,-1)$ and $d_2=(4,2,-2)$. What can you conclude?', choices: ['They must intersect', 'They are parallel', 'They are skew', 'They are perpendicular'], correctIndex: 1, explanation: '$d_2=2d_1$, so the direction vectors are scalar multiples. This means the lines are parallel. (They could be coincident, but they are definitely parallel.)' },
  ],
};

export default mathDPVectors;
