import { Topic } from './types';

const mathDPKinematics: Topic = {
  id: 'math-dp-kinematics',
  subjectId: 'math',
  title: 'Kinematics',
  description: 'Displacement, velocity, and acceleration using calculus. Total distance vs displacement. Constant acceleration (SUVAT) equations. Projectile motion.',
  ibLevel: 'DP',
  notes: [
    { id: 'kin-n1', heading: 'Displacement, Velocity, Acceleration', body: 's(t)=displacement (from origin). v(t)=ds/dt=velocity. a(t)=dv/dt=d²s/dt²=acceleration. Given s(t): differentiate for v,a. Given v(t): s=∫v dt+C; a=dv/dt. Given a(t): v=∫a dt+C₁; s=∫∫a dt²+C₁t+C₂. Direction change: v=0 and sign changes. Speed=|v|.' },
    { id: 'kin-n2', heading: 'Distance vs Displacement', body: 'Displacement = ∫v dt (signed, net). Total distance = ∫|v| dt (always positive). To compute: find all t where v=0, split interval, sum absolute values of sub-integrals. Example: v=t−2 on [0,4]: displacement=0, but distance=|−2|+2=4.' },
    { id: 'kin-n3', heading: 'Motion Graphs', body: 's-t graph: gradient=v (horizontal→stationary). v-t graph: gradient=a; area between curve and axis=displacement (signed); |area|=total distance; v crosses zero→potential direction change. a-t graph: area=Δv. Particle at rest/equilibrium requires v=0 AND a=0.' },
    { id: 'kin-n4', heading: 'SUVAT and Projectile Motion', body: 'Constant acceleration (a only): v=u+at; s=ut+½at²; v²=u²+2as; s=½(u+v)t. g=9.8 m/s² down. Max height: v=0→t=u/g, s=u²/(2g). Projectile (2D): horizontal x=(u cosθ)t; vertical y=(u sinθ)t−½gt². Time of flight: t=2u sinθ/g. Range: R=u² sin2θ/g (max at 45°).' },
    { id: 'kin-n5', heading: 'Speed: Increasing or Decreasing?', body: 'Speed increases when velocity v and acceleration a have the SAME sign (both positive or both negative). Speed decreases when v and a have OPPOSITE signs. This is because speed = |v|, and the derivative of |v| depends on the sign of v. Example: v = −4 m/s and a = −2 m/s² → same sign → speed is increasing (the particle is speeding up in the negative direction). If a switched to +1 m/s², speed would decrease.' },
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
