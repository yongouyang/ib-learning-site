import { Topic } from './types';

const mathDPQuadratics: Topic = {
  id: 'math-dp-quadratics',
  subjectId: 'math',
  title: 'Quadratic Functions & Equations',
  description: "Standard, vertex, and factored forms; completing the square; quadratic formula; discriminant; Vieta's formulas; inequalities; optimisation.",
  ibLevel: 'DP',
  notes: [
    { id: 'qua-n1', heading: 'Forms of a Quadratic', body: 'Standard: f(x)=ax²+bx+c (y-intercept=c). Vertex: f(x)=a(x−h)²+k (vertex at (h,k)). Factored: f(x)=a(x−p)(x−q) (roots at p,q). a>0 → ∪ (min); a<0 → ∩ (max).' },
    { id: 'qua-n2', heading: 'Solving Quadratics', body: 'Formula: x=(−b±√(b²−4ac))/(2a). Discriminant Δ=b²−4ac: Δ>0→2 real; Δ=0→1 repeated; Δ<0→no real. Complete the square: ax²+bx+c = a(x+b/(2a))²+(c−b²/(4a)).' },
    { id: 'qua-n3', heading: "Vieta's Formulas", body: 'For ax²+bx+c=0 with roots α,β: α+β=−b/a, αβ=c/a. Use to check solutions, form quadratics from roots, or solve without finding roots explicitly.' },
    { id: 'qua-n4', heading: 'Inequalities and Optimisation', body: 'Solve ax²+bx+c>0: factor, find roots. If a>0, solution is outside the roots (x<smaller or x>larger). If a<0, between. Vertex at x=−b/(2a) gives max/min. Example: h(t)=−5t²+20t+1 → max at t=2s, h=21m.' },
    { id: 'qua-n5', heading: 'Positive and Negative Definite Quadratics', body: 'A quadratic is positive definite when it is always positive (ax²+bx+c>0 for all x). This happens when a>0 AND Δ<0. It is negative definite when always negative (a<0 AND Δ<0). These concepts are useful for proving inequalities and determining whether a quadratic ever crosses the x-axis.' },
  ],
  flashcards: [
    { id: 'qua-f1', term: 'Standard form', definition: 'f(x)=ax²+bx+c', example: '2x²−4x+1: y-int=1, axis x=1' },
    { id: 'qua-f2', term: 'Vertex form', definition: 'a(x−h)²+k; vertex (h,k)', example: '3(x−2)²−5: vertex (2,−5)' },
    { id: 'qua-f3', term: 'Quadratic formula', definition: 'x=(−b±√Δ)/(2a)', example: 'x²−5x+6→x=2 or 3' },
    { id: 'qua-f4', term: 'Discriminant', definition: 'Δ=b²−4ac determines root nature', example: 'x²−6x+9: Δ=0→repeated root x=3' },
    { id: 'qua-f5', term: 'Completing the square', definition: 'Rewrite ax²+bx+c as a(x+h)²+k to reveal the vertex and solve.', example: 'x²+6x+5=(x+3)²−4; vertex (−3,−4).' },
    { id: 'qua-f6', term: 'Axis of symmetry', definition: 'The vertical line through the vertex: x=−b/(2a).', example: 'For x²−4x+3, axis is x=2.' },
    { id: 'qua-f7', term: 'Positive / Negative definite', definition: 'Always positive (a>0, Δ<0) or always negative (a<0, Δ<0).', example: 'x²+2x+3 has Δ=−8<0, a>0 → always positive.' },
    { id: 'qua-f8', term: "Vieta's sum and product", definition: 'For roots α, β of ax²+bx+c=0: α+β=−b/a and αβ=c/a.', example: 'x²−7x+10=0: sum=7, product=10 → roots 2 and 5.' },
  ],
  questions: [
    { id: 'qua-q1', stem: 'Solve x²−5x+6=0.', choices: ['1,6', '2,3', '−2,−3', '−1,6'], correctIndex: 1, explanation: '(x−2)(x−3)=0.' },
    { id: 'qua-q2', stem: 'Δ of 2x²−3x+5=0?', choices: ['31, 2 real', '−31, no real', '49, 2 real', '−49, no real'], correctIndex: 1, explanation: '9−40=−31<0.' },
    { id: 'qua-q3', stem: 'Vertex form of x²−6x+7:', choices: ['(x−3)²−2', '(x+3)²−2', '(x−3)²+2', '(x−3)²−16'], correctIndex: 0, explanation: '(x−3)²−9+7=(x−3)²−2.' },
    { id: 'qua-q4', stem: 'Max of f(x)=−2x²+8x−3?', choices: ['5 at x=2', '5 at x=−2', '−3 at x=0', '3 at x=2'], correctIndex: 0, explanation: 'x=−b/2a=2. f(2)=5.' },
    { id: 'qua-q5', stem: 'x²−x−12<0 solution:', choices: ['x<−3 or x>4', '−3<x<4', '−4<x<3', 'x<−4 or x>3'], correctIndex: 1, explanation: '(x−4)(x+3)<0 → between roots.' },
    { id: 'qua-q6', stem: 'Rectangle perimeter 40m. Max area?', choices: ['100 m²', '200 m²', '80 m²', '150 m²'], correctIndex: 0, explanation: 'A=x(20−x); max at x=10: 100 m².' },
    { id: 'qua-q7', stem: 'Which condition guarantees that ax²+bx+c is positive for all real x?', choices: ['a>0', 'Δ<0', 'a>0 and Δ<0', 'a<0 and Δ<0'], correctIndex: 2, explanation: 'The parabola must open upward (a>0) AND never touch the x-axis (Δ<0). Together these make the quadratic positive definite.' },
    { id: 'qua-q8', stem: 'By completing the square, write 2x²−8x+5 in the form a(x−h)²+k.', choices: ['2(x−2)²−3', '2(x−4)²−27', '(x−2)²−3', '2(x−2)²+5'], correctIndex: 0, explanation: 'Factor out 2: 2(x²−4x)+5 = 2[(x−2)²−4]+5 = 2(x−2)²−8+5 = 2(x−2)²−3.' },
    { id: 'qua-q9', stem: 'A ball is thrown upward. Its height after t seconds is h(t)=−4t²+16t+3 metres. What is the maximum height reached?', choices: ['16 m', '19 m', '20 m', '23 m'], correctIndex: 1, explanation: 'The maximum occurs at t=−b/(2a)=−16/(−8)=2s. Substituting: h(2)=−4(4)+16(2)+3=−16+32+3=19m.' },
    { id: 'qua-q10', stem: 'A quadratic has roots 3 and −2, and its y-intercept is −12. Find its equation.', choices: ['y=2x²−2x−12', 'y=x²−x−6', 'y=2x²+2x−12', 'y=x²+x−6'], correctIndex: 0, explanation: 'Factored form: y=a(x−3)(x+2). At x=0, y=a(−3)(2)=−6a=−12 → a=2. Expanding: y=2(x²−x−6)=2x²−2x−12.' },
    { id: 'qua-q11', stem: 'For what values of k is x²−4x+k positive for all real x?', choices: ['k>4', 'k<4', 'k≥4', 'k≤4'], correctIndex: 0, explanation: 'Need Δ<0. Δ=(−4)²−4(1)(k)=16−4k<0 → 4k>16 → k>4. When k>4, the parabola opens upward and never touches the x-axis, so it is always positive.' },
    { id: 'qua-q12', stem: 'The line y=3x+c is tangent to the parabola y=x²+5x+2. Find c.', choices: ['1', '2', '3', '4'], correctIndex: 0, explanation: 'Set equal: x²+5x+2=3x+c → x²+2x+(2−c)=0. For tangency, Δ=0. Δ=4−4(2−c)=4c−4=0 → c=1.' },
  ],
};

export default mathDPQuadratics;
