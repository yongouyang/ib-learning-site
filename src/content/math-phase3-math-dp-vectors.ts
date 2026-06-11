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
A vector in 3D has three components. It can be written as a column vector or using base vectors i, j and k.
    v = (v₁, v₂, v₃)   or   v = v₁i + v₂j + v₃k
    where v₁, v₂, v₃ are the displacements in the x, y and z directions.

🔑 Magnitude
The length of a vector is found using Pythagoras in 3D.
    |v| = √(v₁² + v₂² + v₃²)

💡 Worked Example — Magnitude & Unit Vector
Find the magnitude of v = (2, −3, 6) and the unit vector in the same direction.

  Step 1: Calculate the magnitude
    |v| = √(2² + (−3)² + 6²)
    |v| = √(4 + 9 + 36)
    |v| = √49 = 7

  Step 2: Divide each component by the magnitude
    v̂ = (2/7, −3/7, 6/7)

🔑 Unit Vector
A unit vector has magnitude 1 and points in the same direction as the original.
    v̂ = v / |v|

🔑 Vector Operations
• Addition:     a + b = (a₁ + b₁, a₂ + b₂, a₃ + b₃)
• Subtraction:  a − b = (a₁ − b₁, a₂ − b₂, a₃ − b₃)
• Scalar multiplication:  k·a = (k·a₁, k·a₂, k·a₃)

💡 Worked Example — Vector AB & Midpoint
Given A(1, 3, 2) and B(5, 1, 4), find vector AB and the midpoint M.

  Step 1: Write the position vectors
    a = (1, 3, 2)     b = (5, 1, 4)

  Step 2: Subtract to find AB
    AB = b − a = (5−1, 1−3, 4−2) = (4, −2, 2)

  Step 3: Use the midpoint formula
    M = (a + b) / 2
    M = ((1+5)/2, (3+1)/2, (2+4)/2) = (3, 2, 3)

🔑 Position Vectors & Key Formulas
• Position vector of point P:   OP = p
• Vector from A to B:           AB = b − a
• Midpoint of AB:               M = (a + b) / 2
• Section formula — dividing AB in the ratio m : n from A:
    P = (n·a + m·b) / (m + n)

📎 Key Points to Remember
• Column vectors list x, then y, then z from top to bottom.
• i, j, k are unit vectors along the positive x, y, z axes.
• Multiplying by a negative scalar reverses the direction but keeps the line of action.

⚠️ Common Mistake
Mixing up the order in the section formula. When the ratio m : n is measured from A, the point is closer to A when m is small. The formula pairs a with n and b with m:
    P = (n·a + m·b) / (m + n)` },
    { id: 'vec-n2', heading: 'Scalar (Dot) Product', body: `The scalar product turns two vectors into a single number. That number reveals how much the vectors point in the same direction.

📌 Definition
For vectors a = (a₁, a₂, a₃) and b = (b₁, b₂, b₃):
    a · b = a₁b₁ + a₂b₂ + a₃b₃

🔑 Geometric Formula
The scalar product also equals the product of the magnitudes times the cosine of the angle between them.
    a · b = |a| |b| cos θ
    where θ is the angle between the vectors placed tail-to-tail.

💡 Worked Example — Finding the Angle
Find the angle between a = (1, 1, 0) and b = (0, 1, 1).

  Step 1: Calculate the scalar product
    a · b = (1)(0) + (1)(1) + (0)(1) = 1

  Step 2: Find the magnitudes
    |a| = √(1² + 1² + 0²) = √2
    |b| = √(0² + 1² + 1²) = √2

  Step 3: Use the geometric formula
    cos θ = (a · b) / (|a| |b|) = 1 / (√2 × √2) = 1/2

  Step 4: Find the angle
    θ = cos⁻¹(1/2) = 60°

🔑 Perpendicular Test
Two non-zero vectors are perpendicular exactly when their scalar product is zero.
    a · b = 0  ⟺  a ⟂ b

💡 Worked Example — Finding a Missing Component
Find t so that v = (2, t, 5) and w = (t − 1, −1, 1) are perpendicular.

  Step 1: Set the scalar product equal to zero
    v · w = 2(t − 1) + t(−1) + 5(1) = 0

  Step 2: Expand and simplify
    2t − 2 − t + 5 = 0
    t + 3 = 0

  Step 3: Solve
    t = −3

🔑 Scalar Projection
The scalar projection of a onto b is the “shadow” that a casts on b.
    comp_b(a) = (a · b) / |b|

📎 Key Points to Remember
• The result of a dot product is a scalar, never a vector.
• a · a = |a|².
• a · b > 0 means the angle is acute; a · b < 0 means it is obtuse.

⚠️ Common Mistake
Trying to use the dot product to find a perpendicular vector. The dot product only gives a number. To produce a perpendicular vector you need the cross product.` },
    { id: 'vec-n3', heading: 'Vector Equation of a Line', body: `A straight line in 2D or 3D is fully described by one point on the line and a direction to travel along it.

📌 Definition
The vector equation of a line passes through a point with position vector a and runs parallel to direction vector b.

🔑 Vector Form
    r = a + λb
    where:
    • r is the position vector of any point on the line
    • a is the position vector of a known point
    • b is the direction vector
    • λ is a real parameter

🔑 Parametric Form
Splitting into components gives three equations:
    x = a₁ + λb₁
    y = a₂ + λb₂
    z = a₃ + λb₃

🔑 Cartesian Form
If every direction component is non-zero, eliminate λ:
    (x − a₁) / b₁ = (y − a₂) / b₂ = (z − a₃) / b₃

💡 Worked Example — Equation Through Two Points
Find a vector equation of the line through A(4, 0, −5) and B(3, 0, −3).

  Step 1: Choose a point on the line
    a = (4, 0, −5)

  Step 2: Find the direction vector AB
    b = B − A = (3−4, 0−0, −3−(−5)) = (−1, 0, 2)

  Step 3: Write the vector equation
    r = (4, 0, −5) + λ(−1, 0, 2)

💡 Worked Example — Does a Point Lie on the Line?
Determine whether C(2, 0, −1) lies on the line r = (4, 0, −5) + λ(−1, 0, 2).

  Step 1: Set up the component equations
    2 = 4 − λ
    0 = 0 + 0λ
    −1 = −5 + 2λ

  Step 2: Solve the first equation
    λ = 2

  Step 3: Check the other equations
    0 = 0  ✓
    −5 + 2(2) = −1  ✓

Since the same λ = 2 satisfies all three equations, C lies on the line.

📎 Key Points to Remember
• Any scalar multiple of the direction vector represents the same line.
• A line has infinitely many valid vector equations because any point on it can be used for a.
• To test a point, solve for λ in one component and verify it works in the rest.

⚠️ Common Mistake
Using the same parameter letter for two different lines. When looking for an intersection, use different parameters such as λ and μ so you do not accidentally force the points to match.` },
    { id: 'vec-n4', heading: 'Line Classification in 3D', body: `In two dimensions, lines either meet or are parallel. In three dimensions there is a third possibility: they can miss each other without being parallel.

📌 Definitions
• Parallel — direction vectors are scalar multiples of each other.
• Intersecting — the lines share exactly one point.
• Skew — not parallel and do not intersect (unique to 3D and above).

🔑 Parallel Test
Two lines with direction vectors b₁ and b₂ are parallel when:
    b₁ = k·b₂   for some scalar k

🔑 Intersection Test
Write both lines in parametric form using different parameters (λ and μ). Solve the three component equations. If one pair (λ, μ) satisfies all three, the lines meet at that point.

🔑 Skew Test
If the direction vectors are not parallel, attempt the intersection test. If the system of equations has no solution, the lines are skew.

💡 Worked Example — Classify Two Lines
Line L₁: r = (1, 0, 0) + λ(0, 1, 0)
Line L₂: r = (0, 0, 1) + μ(1, 0, 0)

  Step 1: Check for parallelism
    (0, 1, 0) is not a scalar multiple of (1, 0, 0).
    The lines are not parallel.

  Step 2: Set the parametric components equal
    1 = 0 + μ     →  μ = 1
    0 + λ = 0     →  λ = 0
    0 = 1 + 0     →  0 = 1  ✗

  Step 3: Interpret the result
    The third equation is impossible, so there is no intersection.

Conclusion: L₁ and L₂ are skew.

📎 Key Points to Remember
• Skew lines exist only when there are at least three dimensions.
• Coincident lines are parallel lines that lie on top of each other.
• Always check parallelism first — it is the fastest test.

⚠️ Common Mistake
Assuming that non-parallel lines in 3D must intersect. Most non-parallel lines in 3D are skew. You must solve the equations to be certain.` },
    { id: 'vec-n5', heading: 'Vector (Cross) Product and Geometric Applications', body: `The cross product multiplies two vectors to produce a third vector that is perpendicular to both. It is the key to finding areas and shortest distances in 3D.

📌 Definition
For a = (a₁, a₂, a₃) and b = (b₁, b₂, b₃):
    a × b = (a₂b₃ − a₃b₂,  a₃b₁ − a₁b₃,  a₁b₂ − a₂b₁)

🔑 Magnitude of the Cross Product
    |a × b| = |a| |b| sin θ
    where θ is the angle between the vectors.

💡 Worked Example — Triangle Area
Find the area of the triangle with vertices A(1, 0, 0), B(3, 1, 2) and C(2, −1, 4).

  Step 1: Form two side vectors
    AB = B − A = (2, 1, 2)
    AC = C − A = (1, −1, 4)

  Step 2: Compute the cross product AB × AC
    = ( (1)(4) − (2)(−1),  (2)(1) − (2)(4),  (2)(−1) − (1)(1) )
    = (4 + 2,  2 − 8,  −2 − 1)
    = (6, −6, −3)

  Step 3: Find the magnitude
    |AB × AC| = √(6² + (−6)² + (−3)²) = √81 = 9

  Step 4: Halve it for the triangle
    Area = ½ × 9 = 9/2

🔑 Area Formulas
• Parallelogram with adjacent sides a and b:
    Area = |a × b|
• Triangle with two sides a and b:
    Area = ½ |a × b|

🔑 Shortest Distance from a Point to a Line
For a line r = a + λb and a point P not on the line, choose any point A on the line and form vector AP.
    d = |AP × b| / |b|

💡 Worked Example — Shortest Distance
Find the shortest distance from P(3, 1, −2) to the line r = (1, 0, 1) + λ(2, −1, 2).

  Step 1: Choose A on the line and find AP
    A = (1, 0, 1)
    AP = P − A = (2, 1, −3)

  Step 2: Compute AP × b
    = ( (1)(2) − (−3)(−1),  (−3)(2) − (2)(2),  (2)(−1) − (1)(2) )
    = (2 − 3,  −6 − 4,  −2 − 2)
    = (−1, −10, −4)

  Step 3: Find the magnitudes
    |AP × b| = √((−1)² + (−10)² + (−4)²) = √117
    |b| = √(2² + (−1)² + 2²) = 3

  Step 4: Divide
    d = √117 / 3 = √13

📎 Key Points to Remember
• a × b is perpendicular to both a and b. The right-hand rule gives the direction.
• a × b = −(b × a). Reversing the order flips the sign of every component.
• If a × b = 0 (and neither vector is zero), the vectors are parallel.

⚠️ Common Mistake
Using the dot product instead of the cross product when finding area. Area depends on sin θ, which comes from the cross product, not cos θ.` },
    { id: 'vec-n6', heading: 'Shortest Distance Between Moving Objects', body: `When two objects move with constant velocity, their paths are straight lines. You can use vectors to find the time at which they are closest together and what that shortest distance is.

📌 Setup
Let the position vectors of two objects at time t be:
    r_A = a + t·v_A
    r_B = b + t·v_B
    where a, b are initial positions and v_A, v_B are constant velocity vectors.

The vector joining them at time t is:
    AB = r_B − r_A = (b − a) + t(v_B − v_A)

The distance between them is |AB|. To avoid square roots, minimise |AB|².

💡 Worked Example — Closest Approach of Two Ships
Ship A starts at (0, 0) with velocity (3, 4) km/h.
Ship B starts at (10, 0) with velocity (0, 5) km/h.
Find the time when they are closest and the shortest distance.

  Step 1: Write position vectors at time t
    r_A = (0, 0) + t(3, 4) = (3t, 4t)
    r_B = (10, 0) + t(0, 5) = (10, 5t)

  Step 2: Find the displacement vector from A to B
    AB = r_B − r_A = (10 − 3t, 5t − 4t) = (10 − 3t, t)

  Step 3: Form an expression for the squared distance
    |AB|² = (10 − 3t)² + t²
    |AB|² = 100 − 60t + 9t² + t²
    |AB|² = 10t² − 60t + 100

  Step 4: Differentiate with respect to t and set to zero
    d/dt(|AB|²) = 20t − 60 = 0
    t = 3

  Step 5: Find the minimum distance
    |AB|² at t = 3: 10(9) − 60(3) + 100 = 90 − 180 + 100 = 10
    Shortest distance = √10 km

🔑 Alternative Method (Calculus-free)
If you prefer not to differentiate, complete the square on the quadratic in t:
    |AB|² = 10(t² − 6t) + 100
    |AB|² = 10(t − 3)² + 10
The minimum occurs at t = 3 and equals √10 km.

📎 Key Points to Remember
• Always minimise the squared distance — it avoids awkward square-root algebra.
• The method works in both 2D and 3D.
• If the objects are on a collision course, the minimum distance is zero.

⚠️ Common Mistake
Differentiating the distance |AB| directly instead of |AB|². This creates a messy chain-rule expression and is much harder to solve. Squaring first keeps everything simple.` },
  ],
  flashcards: [
    { id: 'vec-f1', term: 'Magnitude', definition: '|v| = √(v₁²+v₂²+v₃²)', example: '(2,−3,6): √(4+9+36)=7.' },
    { id: 'vec-f2', term: 'Unit Vector', definition: 'v̂ = v/|v|; magnitude 1.', example: '(3,4): |v|=5, v̂=(3/5,4/5).' },
    { id: 'vec-f3', term: 'Scalar Product', definition: 'a·b = a₁b₁+a₂b₂+a₃b₃ = |a||b|cosθ', example: '(1,2,3)·(4,−1,2)=4−2+6=8.' },
    { id: 'vec-f4', term: 'Perpendicular test', definition: 'a·b = 0 → a⊥b', example: '(2,3)·(3,−2)=6−6=0.' },
    { id: 'vec-f5', term: 'Vector equation of line', definition: 'r = a + λb', example: 'Through (1,2,3), direction (2,−1,4).' },
    { id: 'vec-f6', term: 'Skew lines', definition: '3D lines that are neither parallel nor intersecting.', example: 'L₁: r=(1,0,0)+λ(0,1,0); L₂: r=(0,0,1)+μ(1,0,0) are skew.' },
    { id: 'vec-f7', term: 'Parallel vectors', definition: 'Two vectors are parallel if one is a scalar multiple of the other.', example: '(2,−1,4) and (6,−3,12) are parallel because (6,−3,12)=3(2,−1,4).' },
    { id: 'vec-f8', term: 'Cross product magnitude', definition: '|a×b| = |a||b|sinθ', example: '|a|=3, |b|=4, θ=90° → |a×b|=12.' },
    { id: 'vec-f9', term: 'Shortest distance from point to line', definition: 'd = |AP×b| / |b| where A is on the line and b is the direction vector.', example: 'P(3,1,−2), line r=(1,0,1)+λ(2,−1,2) → d=√13.' },
    { id: 'vec-f10', term: 'Area with cross product', definition: 'Parallelogram area = |a×b|; triangle area = ½|a×b|.', example: 'Triangle with adjacent sides a=(2,1,2), b=(1,−1,4) has area 9/2.' },
  ],
  questions: [
    { id: 'vec-q1', stem: '|v| where v=(2,−3,6)?', choices: ['5', '7', '√11', '49'], correctIndex: 1, explanation: '√(4+9+36)=√49=7.' },
    { id: 'vec-q2', stem: 'a=(1,2,−1), b=(3,0,2). a·b=?', choices: ['5', '1', '3', '7'], correctIndex: 1, explanation: '3+0−2=1.' },
    { id: 'vec-q3', stem: 'Which pair is perpendicular?', choices: ['(1,2) and (4,2)', '(3,−4) and (4,3)', '(2,1) and (1,2)', '(5,2) and (2,5)'], correctIndex: 1, explanation: '12−12=0 → perpendicular.' },
    { id: 'vec-q4', stem: 'Angle between (1,1,0) and (0,1,1)?', choices: ['30°', '45°', '60°', '90°'], correctIndex: 2, explanation: 'cosθ=1/(√2·√2)=1/2 → θ=60°.' },
    { id: 'vec-q5', stem: 'Midpoint of A(1,3,2) and B(5,1,4)?', choices: ['(3,2,3)', '(4,−2,2)', '(6,4,6)', '(2,4,1)'], correctIndex: 0, explanation: '((1+5)/2, (3+1)/2, (2+4)/2) = (3,2,3).' },
    { id: 'vec-q6', stem: '|a|=3, |b|=4, ∠60°. a·b=?', choices: ['6', '12', '12√3', '6√3'], correctIndex: 0, explanation: '3×4×cos60°=12×0.5=6.' },
    { id: 'vec-q7', stem: 'Which operation on two vectors produces another vector?', choices: ['Dot product', 'Scalar product', 'Cross product', 'Scalar projection'], correctIndex: 2, explanation: 'The dot product (also called scalar product) and scalar projection both produce scalars. Only the cross product produces a vector perpendicular to both inputs.' },
    { id: 'vec-q8', stem: 'v=(2,−1,4) and w=(6,k,12). Find k so that v and w are parallel.', choices: ['−2', '−3', '3', '4'], correctIndex: 1, explanation: 'Parallel vectors are scalar multiples. 6÷2=3 and 12÷4=3, so w=3v. Thus k=3×(−1)=−3.' },
    { id: 'vec-q9', stem: 'What is the shortest distance from P(3,1,−2) to the line r=(1,0,1)+λ(2,−1,2)?', choices: ['√13', '√117', '3', '√13/3'], correctIndex: 0, explanation: 'A=(1,0,1) is on the line, AP=(2,1,−3). AP×b=(−1,−10,−4) with magnitude √117. |b|=√(4+1+4)=3. Distance = √117÷3 = √13.' },
    { id: 'vec-q10', stem: 'Triangle with vertices A(1,0,0), B(3,1,2), C(2,−1,4). What is its area?', choices: ['9/2', '9', '√81', '81/2'], correctIndex: 0, explanation: 'AB=(2,1,2), AC=(1,−1,4). AB×AC=(6,−6,−3), magnitude 9. Triangle area = ½×9 = 9/2.' },
    { id: 'vec-q11', stem: 'Ship A starts at (0,0) with velocity (3,4) km/h. Ship B starts at (10,0) with velocity (0,5) km/h. After how many hours are they closest?', choices: ['t=2', 't=3', 't=4', 't=5'], correctIndex: 1, explanation: 'At time t, AB=(10−3t, t). |AB|²=(10−3t)²+t²=10t²−60t+100. Differentiate: 20t−60=0 → t=3. At t=3 the distance is √10, the minimum.' },
    { id: 'vec-q12', stem: 'Two lines in 3D have direction vectors d₁=(2,1,−1) and d₂=(4,2,−2). What can you conclude?', choices: ['They must intersect', 'They are parallel', 'They are skew', 'They are perpendicular'], correctIndex: 1, explanation: 'd₂=2d₁, so the direction vectors are scalar multiples. This means the lines are parallel. (They could be coincident, but they are definitely parallel.)' },
  ],
};

export default mathDPVectors;
