import { Topic } from './types';

const mathDPKinematics: Topic = {
  id: 'math-dp-kinematics',
  subjectId: 'math',
  title: 'Kinematics',
  description: 'Displacement, velocity, and acceleration using calculus. Total distance vs displacement. Constant acceleration (SUVAT) equations. Projectile motion.',
  ibLevel: 'DP',
  notes: [
    {
      id: 'kin-n1',
      heading: 'Displacement, Velocity, and Acceleration',
      body: `Kinematics describes how objects move along a straight line. We use three connected functions: displacement, velocity, and acceleration.

📌 Definition
Displacement s(t) tells you where the particle is relative to a fixed origin O.
• s(t) > 0  →  particle is to the right of O
• s(t) = 0  →  particle is at O
• s(t) < 0  →  particle is to the left of O

🔑 Key Relationships
    v(t) = ds/dt        (velocity is the derivative of displacement)
    a(t) = dv/dt = d²s/dt²   (acceleration is the derivative of velocity)

The units depend on what you choose for s and t. If s is in metres and t in seconds:
• displacement → metres (m)
• velocity     → m/s
• acceleration → m/s²

💡 Worked Example — Given s(t), find v and a
A particle moves with displacement s(t) = 3t − t² metres.

  Step 1: Differentiate to find velocity
    v(t) = ds/dt = 3 − 2t  m/s

  Step 2: Differentiate again to find acceleration
    a(t) = dv/dt = −2  m/s²

  The acceleration is constant and negative, so the particle is always slowing down in the positive direction (or speeding up in the negative direction).

💡 Worked Example — Given a(t), find v and s
A particle accelerates with a(t) = 6t m/s². Initially v(0) = 4 m/s and s(0) = 1 m.

  Step 1: Integrate acceleration for velocity
    v(t) = ∫ 6t dt = 3t² + C₁
    v(0) = 4  →  C₁ = 4
    v(t) = 3t² + 4  m/s

  Step 2: Integrate velocity for displacement
    s(t) = ∫ (3t² + 4) dt = t³ + 4t + C₂
    s(0) = 1  →  C₂ = 1
    s(t) = t³ + 4t + 1  m

📎 Key Points to Remember
• Given s(t): differentiate once for v(t), twice for a(t)
• Given v(t): differentiate for a(t); integrate for s(t) (don’t forget +C)
• Given a(t): integrate once for v(t), twice for s(t) (two constants!)
• Use initial conditions (t = 0 values) to find the constants of integration

⚠️ Common Mistake
Forgetting the constants of integration when working backwards from acceleration. You need TWO separate constants: C₁ for velocity and C₂ for displacement. Always use the initial conditions to find them.`
    },
    {
      id: 'kin-n2',
      heading: 'Distance vs Displacement',
      body: `Displacement and total distance sound similar, but they measure very different things. Displacement cares about direction; distance does not.

📌 Definition
    Displacement  =  ∫ v(t) dt   (signed — tells you net change in position)
    Total distance =  ∫ |v(t)| dt  (always positive — every metre travelled counts)

🔑 How to Calculate Total Distance
1. Find all times where v(t) = 0 inside the interval
2. Split the integral at each of those times
3. Evaluate ∫ v(t) dt on each sub-interval
4. Add the absolute values of each piece

💡 Worked Example
A particle has velocity v(t) = t − 2 m/s on the interval 0 ≤ t ≤ 4.

  Step 1: Find where v(t) = 0
    t − 2 = 0  →  t = 2

  Step 2: Split the integral at t = 2
    Displacement = ∫₀⁴ (t − 2) dt
                 = [t²/2 − 2t]₀⁴
                 = (8 − 8) − 0 = 0 m

    Total distance = |∫₀² (t − 2) dt| + |∫₂⁴ (t − 2) dt|

  Step 3: Evaluate each piece
    ∫₀² (t − 2) dt = [t²/2 − 2t]₀² = (2 − 4) − 0 = −2
    |−2| = 2

    ∫₂⁴ (t − 2) dt = [t²/2 − 2t]₂⁴ = (8 − 8) − (2 − 4) = 2
    |2| = 2

  Step 4: Add the absolute values
    Total distance = 2 + 2 = 4 m

📎 Key Points to Remember
• Displacement can be zero even when the particle has moved — it just returned to where it started
• Total distance is never negative
• Always find where v(t) = 0 before computing total distance
• You can also use a sign diagram for v(t) to spot direction changes quickly

⚠️ Common Mistake
Using displacement as distance. If a particle goes 5 m forward then 5 m back, its displacement is 0 but its total distance is 10 m. Never skip the step of finding where v(t) = 0.`
    },
    {
      id: 'kin-n3',
      heading: 'Motion Graphs',
      body: `Graphs make the relationships between displacement, velocity, and acceleration visual. Each graph tells a different story about the particle’s motion.

📌 s–t Graph (Displacement vs Time)
    Gradient at any point = instantaneous velocity
• Positive gradient  →  moving right
• Negative gradient  →  moving left
• Zero gradient      →  instantaneously at rest
• Horizontal line    →  stationary

📌 v–t Graph (Velocity vs Time)
    Gradient at any point = instantaneous acceleration
    Signed area between curve and t-axis = displacement
    Total area (treating all regions as positive) = total distance
• v crosses zero  →  potential direction change
• v and a same sign  →  speed increasing
• v and a opposite signs  →  speed decreasing

📌 a–t Graph (Acceleration vs Time)
    Signed area between curve and t-axis = change in velocity (Δv)
• Positive area  →  velocity increases
• Negative area  →  velocity decreases

💡 Worked Example — Reading a v–t Graph
A train’s velocity–time graph consists of:
• 0 to 0.1 h: speed increases uniformly from 0 to 50 km/h
• 0.1 to 0.3 h: constant speed 50 km/h
• 0.3 to 0.4 h: speed decreases uniformly from 50 to 30 km/h
• 0.4 to 0.5 h: constant speed 30 km/h
• 0.5 to 0.6 h: speed decreases uniformly from 30 to 0 km/h

  Step 1: Break the graph into simple shapes
    Area A (triangle):   ½ × 0.1 × 50 = 2.5 km
    Area B (rectangle):  0.2 × 50 = 10 km
    Area C (trapezium):  ½ × (50 + 30) × 0.1 = 4 km
    Area D (rectangle):  0.1 × 30 = 3 km
    Area E (triangle):   ½ × 0.1 × 30 = 1.5 km

  Step 2: Sum the areas for total distance
    Total distance = 2.5 + 10 + 4 + 3 + 1.5 = 21 km

📎 Key Points to Remember
• On an s–t graph, turning points (local max/min) are where v = 0
• On a v–t graph, the particle is at rest whenever v = 0
• The phrase "particle at rest / in equilibrium" requires BOTH v = 0 AND a = 0
• Area above the t-axis = positive displacement; area below = negative displacement

⚠️ Common Mistake
Confusing s–t graphs with v–t graphs. On an s–t graph, a turning point means the particle changes direction. On a v–t graph, the curve crossing the axis means the same thing — but the shape of the graph itself looks completely different. Always check the label on the vertical axis.`
    },
    {
      id: 'kin-n4',
      heading: 'SUVAT and Projectile Motion',
      body: `When acceleration is constant, we can use a special set of equations called the SUVAT equations. These are essential for projectile problems and any motion with uniform acceleration.

📌 Definition — Constant Acceleration
Acceleration a is constant (does not change with time). This happens when gravity is the only force acting, such as in free fall or projectile motion near Earth’s surface.

🔑 SUVAT Equations
Let u = initial velocity, v = final velocity, a = acceleration, t = time, s = displacement.

    v = u + at
    s = ut + ½at²
    v² = u² + 2as
    s = ½(u + v)t

Choose the equation that contains the variable you want and the variables you already know.

💡 Worked Example — Vertical Motion Under Gravity
A ball is thrown vertically upward from ground level with speed 24.5 m/s. Take g = 9.8 m/s².

  Step 1: Find time to maximum height
    At max height, v = 0
    v = u + at
    0 = 24.5 − 9.8t
    t = 24.5 / 9.8 = 2.5 s

  Step 2: Find maximum height
    Using v² = u² + 2as:
    0 = 24.5² + 2(−9.8)s
    19.6s = 600.25
    s = 600.25 / 19.6 ≈ 30.6 m

🔑 Projectile Motion (2D)
For a projectile launched with speed u at angle θ above horizontal:

    Horizontal:  x = (u cos θ) t
    Vertical:    y = (u sin θ) t − ½gt²

Key results (derived from the vertical equation):
    Time of flight:     T = 2u sin θ / g
    Maximum height:     H = u² sin²θ / (2g)
    Range:              R = u² sin 2θ / g

Maximum range occurs at θ = 45° (since sin 90° = 1).

💡 Worked Example — Projectile Range
A ball is kicked with speed 30 m/s at 45° to the horizontal. Find the range. Take g = 9.8 m/s².

    R = u² sin 2θ / g
    R = 30² × sin 90° / 9.8
    R = 900 × 1 / 9.8
    R ≈ 91.8 m

📎 Key Points to Remember
• Always draw a diagram and choose a positive direction before applying SUVAT
• For vertical motion, taking upward as positive means a = −g = −9.8 m/s²
• Horizontal and vertical motions are independent — time is the link between them
• At maximum height, vertical velocity is zero (but horizontal velocity is unchanged)
• Time of flight depends only on the vertical component of velocity

⚠️ Common Mistake
Using s = ut without the ½at² term, or using a = +g when upward is chosen as positive. The sign of acceleration must match your chosen positive direction. If up is positive, gravity acts downward so a = −9.8 m/s².`
    },
    {
      id: 'kin-n5',
      heading: 'Speed: Increasing or Decreasing?',
      body: `A particle can be speeding up or slowing down even when its acceleration is constant. The key is to compare the signs of velocity and acceleration.

📌 Definition
Speed is the magnitude of velocity:  speed = |v|.
Because speed ignores direction, it behaves differently from velocity when acceleration is applied.

🔑 The Sign Rule
    If v and a have the SAME sign     →  speed is INCREASING
    If v and a have OPPOSITE signs    →  speed is DECREASING

Why does this work?
• When v > 0 and a > 0, velocity becomes more positive → |v| grows
• When v < 0 and a < 0, velocity becomes more negative → |v| grows
• When v > 0 and a < 0, velocity shrinks toward zero → |v| shrinks
• When v < 0 and a > 0, velocity rises toward zero → |v| shrinks

💡 Worked Example 1 — Same Sign
A particle has v = −4 m/s and a = −2 m/s².

  Both v and a are negative → same sign.
  Therefore speed is increasing.
  The particle is moving left and accelerating left — it is speeding up in the negative direction.
  Initial speed = |−4| = 4 m/s.
  After 1 s: v = −4 + (−2)(1) = −6 m/s → speed = 6 m/s.
  Speed has increased from 4 to 6 m/s.

💡 Worked Example 2 — Opposite Signs
A particle has v = −5 m/s and a = +3 m/s².

  v is negative, a is positive → opposite signs.
  Therefore speed is decreasing.
  The particle is moving left but acceleration acts to the right — it is braking.
  Initial speed = 5 m/s.
  After 1 s: v = −5 + 3 = −2 m/s → speed = 2 m/s.
  Speed has decreased from 5 to 2 m/s.

📎 Key Points to Remember
• "Speeding up" means |v| is getting larger, regardless of direction
• "Slowing down" means |v| is getting smaller
• A negative velocity with negative acceleration does NOT mean the particle is slowing down
• If v = 0, the particle is instantaneously at rest; check the sign of a to see which way it will move next

⚠️ Common Mistake
Assuming positive acceleration always means speeding up. If a particle is moving left (v < 0) and accelerating right (a > 0), it is actually slowing down. Always check both signs before deciding.`
    },
  ],
  flashcards: [
    { id: 'kin-f1', term: 'v from s', definition: 'v=ds/dt (first derivative)', example: 's=3t²−2t → v=6t−2.' },
    { id: 'kin-f2', term: 'a from v', definition: 'a=dv/dt=d²s/dt²', example: 'v=6t−2 → a=6 m/s².' },
    { id: 'kin-f3', term: 's from v', definition: 's=∫v dt+C; use s(0)=s₀', example: 'v=4t+1, s₀=3 → s=2t²+t+3.' },
    { id: 'kin-f4', term: 'Distance vs Displacement', definition: 'Distance=∫|v|dt (split at v=0)', example: 'v=t−2 on [0,4]: disp=0, dist=4.' },
    { id: 'kin-f5', term: 'SUVAT', definition: 'v=u+at; s=ut+½at²; v²=u²+2as', example: 'Ball thrown up at 20m/s: max height 20.4m.' },
    { id: 'kin-f6', term: 'Projectile range', definition: 'R=u² sin2θ/g', example: 'u=30, θ=45° → R≈91.8m.' },
    { id: 'kin-f7', term: 'When does speed increase?', definition: 'Speed increases when v and a have the same sign; speed decreases when they have opposite signs.', example: 'v=−3 m/s, a=−1 m/s² → same sign → speed increases from 3 m/s.' },
    { id: 'kin-f8', term: 'Average velocity', definition: 'Average velocity = (change in displacement)/(change in time) = (s(t₂)−s(t₁))/(t₂−t₁)', example: 's=t²−4t from t=0 to t=5: avg vel = (5−0)/5 = −1 m/s.' },
    { id: 'kin-f9', term: 'Area under v-t graph', definition: 'The signed area under a velocity-time graph gives displacement; the total area (treating all regions as positive) gives total distance.', example: 'A triangle from t=0 to t=4 with v from 8 to 0 has area 16 → displacement = 16 m.' },
    { id: 'kin-f10', term: 'Acceleration from v(s)', definition: 'If velocity is given as a function of displacement, a = v(dv/ds) by the chain rule.', example: 'v=2s → dv/ds=2 → a=v·2=4s. At s=1, a=4 m/s².' },
  ],
  questions: [
    { id: 'kin-q1', stem: 's=2t³−3t²+1. v at t=2?', choices: ['12 m/s', '18 m/s', '6 m/s', '24 m/s'], correctIndex: 0, explanation: 'v=6t²−6t; v(2)=24−12=12.' },
    { id: 'kin-q2', stem: 'v=4t−8. When does particle change direction?', choices: ['t=2', 't=4', 't=8', 't=0'], correctIndex: 0, explanation: 'v=0→t=2; v changes sign there.' },
    { id: 'kin-q3', stem: 'v=6t²−6. a at t=3?', choices: ['48 m/s²', '36 m/s²', '12 m/s²', '30 m/s²'], correctIndex: 1, explanation: 'a=12t; a(3)=36.' },
    { id: 'kin-q4', stem: 'v=3t²−12t+9, s(0)=0. s at t=2?', choices: ['2', '−2', '4', '6'], correctIndex: 0, explanation: 's=t³−6t²+9t; s(2)=8−24+18=2.' },
    { id: 'kin-q5', stem: 'a=6t, v(0)=4, s(0)=1. s(t)=?', choices: ['t³+4t+1', '3t²+4t+1', 't³+4', '6t+4'], correctIndex: 0, explanation: 'v=3t²+4; s=t³+4t+1.' },
    { id: 'kin-q6', stem: 'Ball thrown up at 19.6 m/s. Time to max height? (g=9.8)', choices: ['1 s', '2 s', '3 s', '4 s'], correctIndex: 1, explanation: 'v=19.6−9.8t=0→t=2.' },
    { id: 'kin-q7', stem: 'A particle has velocity v = −5 m/s and acceleration a = 3 m/s². Which statement is correct?', choices: ['The particle is slowing down and moving to the left', 'The particle is speeding up and moving to the left', 'The particle is slowing down and moving to the right', 'The particle is speeding up and moving to the right'], correctIndex: 0, explanation: 'Negative velocity means the particle is moving to the left. Positive acceleration acts to the right, which is opposite to the direction of motion. When velocity and acceleration have opposite signs, speed decreases — the particle is slowing down.' },
    { id: 'kin-q8', stem: 'A ball is thrown vertically upward from ground level with speed 24.5 m/s. Taking g = 9.8 m/s², what is the maximum height reached?', choices: ['30.6 m', '61.3 m', '2.5 s', '24.5 m'], correctIndex: 0, explanation: 'Using v² = u² + 2as with final velocity v = 0: 0 = 24.5² − 2(9.8)s → s = 600.25/19.6 ≈ 30.6 m. 61.3 m comes from forgetting the deceleration (s = ut), 2.5 s is the time to max height, and 24.5 m is the initial speed.' },
    { id: 'kin-q9', stem: 'A particle moves with velocity v(t) = 3t² − 12t + 9 m/s. What is the total distance travelled in the first 4 seconds?', choices: ['12 m', '4 m', '0 m', '16 m'], correctIndex: 0, explanation: 'Factor: v = 3(t−1)(t−3), so direction changes at t=1 and t=3. s(t) = t³ − 6t² + 9t. s(0)=0, s(1)=4, s(3)=0, s(4)=4. Total distance = |4−0| + |0−4| + |4−0| = 4 + 4 + 4 = 12 m. 4 m is the net displacement, 0 m incorrectly assumes the particle returns to the start, and 16 m adds displacements without accounting for backtracking.' },
    { id: 'kin-q10', stem: 'A particle moves with displacement s(t) = t² − 6t + 5 metres. What is the average velocity during the first 5 seconds?', choices: ['−1 m/s', '0 m/s', '−5 m/s', '5 m/s'], correctIndex: 0, explanation: 'Average velocity = (s(5)−s(0))/(5−0) = (0−5)/5 = −1 m/s. s(5) = 25−30+5 = 0 and s(0) = 5. 0 m/s would be the average speed if distances were equal, −5 m/s forgets to divide by time, and 5 m/s takes s(0) without the sign change.' },
    { id: 'kin-q11', stem: 'The acceleration of a particle is a(t) = 4 − 2t m/s². Initially the particle is at rest at the origin. Find its displacement after 3 seconds.', choices: ['9 m', '3 m', '18 m', '0 m'], correctIndex: 0, explanation: 'Integrate: v(t) = 4t − t² + C₁. v(0)=0 → C₁=0. Integrate again: s(t) = 2t² − t³/3 + C₂. s(0)=0 → C₂=0. At t=3: s(3) = 2(9) − 27/3 = 18 − 9 = 9 m. 3 m is the velocity at t=3, 18 m forgets to divide the t³ term by 3, and 0 m ignores the constants of integration.' },
    { id: 'kin-q12', stem: 'The displacement-time graph of a particle is a parabola opening downward. At the vertex of the parabola, which statement is true?', choices: ['The velocity is zero and the acceleration is negative', 'The velocity is zero and the acceleration is positive', 'The velocity is maximum and the acceleration is zero', 'The velocity is negative and the acceleration is zero'], correctIndex: 0, explanation: 'A downward-opening parabola has equation s = −at² + bt + c with a > 0. The velocity v = ds/dt = −2at + b is zero at the vertex (turning point). The acceleration a = d²s/dt² = −2a is negative. Students often confuse s-t graphs with v-t graphs, which is why "velocity is maximum" is a tempting distractor.' },
  ],
};

export default mathDPKinematics;
