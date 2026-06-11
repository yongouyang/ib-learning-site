import { Topic } from './types';

const mathDPVectors: Topic = {
  id: 'math-dp-vectors',
  subjectId: 'math',
  title: 'Vectors',
  description: 'Vector notation, magnitude, unit vectors, scalar product, angle between vectors, vector equation of a line, and classifying lines in 3D.',
  ibLevel: 'DP',
  notes: [
    { id: 'vec-n1', heading: 'Vector Notation and Basic Operations', body: 'A vector has magnitude and direction. Components: v=(v₁,v₂,v₃). Magnitude: |v|=√(v₁²+v₂²+v₃²). Unit vector: v̂=v/|v|. Operations: a+b=(a₁+b₁,a₂+b₂,a₃+b₃); ka=(ka₁,ka₂,ka₃). Position vector: OP=p. Vector AB = b−a. Midpoint: (a+b)/2. Section formula: dividing AB in ratio m:n from A gives (n·a+m·b)/(m+n).' },
    { id: 'vec-n2', heading: 'Scalar (Dot) Product', body: 'a·b = |a||b|cosθ = a₁b₁+a₂b₂+a₃b₃. Properties: commutative, distributive. a·a=|a|². If a·b=0 and neither is zero → perpendicular. Angle: cosθ = (a·b)/(|a||b|). a·b>0→acute; a·b<0→obtuse. Scalar projection of a onto b: (a·b)/|b|.' },
    { id: 'vec-n3', heading: 'Vector Equation of a Line', body: 'Line through A (position vector a) with direction b: r = a + λb (λ∈ℝ). Parametric: x=a₁+λb₁, y=a₂+λb₂, z=a₃+λb₃. Cartesian: (x−a₁)/b₁=(y−a₂)/b₂=(z−a₃)/b₃. To check if point P lies on line: substitute and see if λ is consistent.' },
    { id: 'vec-n4', heading: 'Line Classification in 3D', body: 'Two lines are parallel if their direction vectors are scalar multiples. In 3D, non-parallel lines can intersect or be skew. Skew lines: non-parallel and non-intersecting (exist only in 3D). Test: solve parametric equations; if consistent → intersect; if inconsistent → skew.' },
    { id: 'vec-n5', heading: 'Vector (Cross) Product and Geometric Applications', body: 'The cross product a×b produces a vector perpendicular to both a and b. In component form: a×b=(a₂b₃−a₃b₂, a₃b₁−a₁b₃, a₁b₂−a₂b₁). Magnitude: |a×b|=|a||b|sinθ. Key uses: (1) Area of parallelogram = |a×b|; area of triangle = ½|a×b|. (2) Shortest distance from point P to line r=a+λb is |AP×b|/|b| where A is any point on the line. (3) Test for parallel: non-zero a×b=0 means a and b are parallel. The cross product is anti-commutative: a×b = −(b×a).' },
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
