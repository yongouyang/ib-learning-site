import { Topic } from './types';

const mathDpComplexNumbers: Topic = {
  id: 'math-dp-complex-numbers',
  subjectId: 'math',
  title: 'Complex Numbers',
  description: 'Cartesian form, Argand diagrams, modulus and argument, polar and Euler forms, and the geometry of complex operations.',
  ibLevel: 'DP',
  notes: [
    {
      id: 'math-dp-complex-numbers-n1',
      heading: 'Introduction to Complex Numbers & Cartesian Form',
      body: 'Complex numbers extend the real number system so that every quadratic equation has a solution. They are built from a real part and an imaginary part linked by the special number i.\n\n📌 Definition of the Imaginary Unit\ni is defined by the property:\n    i² = −1\nThis means the square root of any negative number can be rewritten:\n    √−a = i√a     (for a > 0)\n\n📌 Cartesian Form\nA complex number z is written as:\n    z = a + bi\nwhere a, b ∈ ℝ.\n• a = Re(z) is the real part\n• b = Im(z) is the imaginary part\n\nTwo complex numbers are equal only when both their real parts and their imaginary parts match.\n\n🔑 Addition & Subtraction\nCombine the real and imaginary parts separately:\n    (a + bi) + (c + di) = (a + c) + (b + d)i\n    (a + bi) − (c + di) = (a − c) + (b − d)i\n\n🔑 Multiplication in Cartesian Form\nExpand just like algebraic brackets, replacing i² with −1:\n    (a + bi)(c + di) = ac + adi + bci + bdi²\n                     = (ac − bd) + (ad + bc)i\n\n💡 Worked Example — Multiplication\nSimplify (2 + 3i)(1 − i).\n\n  Step 1: Expand the brackets\n    2 − 2i + 3i − 3i²\n\n  Step 2: Replace i² with −1\n    2 + i − 3(−1)\n\n  Step 3: Simplify\n    2 + i + 3 = 5 + i\n\n🔑 Powers of i\nThe powers of i repeat every four steps:\n    i¹ = i\n    i² = −1\n    i³ = −i\n    i⁴ = 1\n\nTo simplify a higher power, divide the exponent by 4 and use the remainder:\n    i²³ = i^(4×5 + 3) = (i⁴)⁵ · i³ = 1⁵ · (−i) = −i\n\n💡 Worked Example — Higher Power of i\nSimplify i³⁸.\n\n  Step 1: Divide 38 by 4\n    38 = 4 × 9 + 2, so the remainder is 2\n\n  Step 2: Use the cycle\n    i³⁸ = i² = −1\n\n📎 Key Points to Remember\n• Always replace i² with −1 before collecting terms\n• Multiplication of two complex numbers always gives another complex number\n• For higher powers of i, look for the remainder when dividing by 4\n\n⚠️ Common Mistake\nWriting √−a · √−b = √(ab). This is only true for real numbers. With negatives:\n    √−4 × √−9 = (2i)(3i) = 6i² = −6,   not √36 = 6',
    },
    {
      id: 'math-dp-complex-numbers-n2',
      heading: 'Complex Conjugates, Division & Modulus',
      body: 'The complex conjugate is a powerful tool that turns division into a simple fraction with a real denominator. It is also closely tied to the modulus, which measures the size of a complex number.\n\n📌 Complex Conjugate\nFor z = a + bi, the conjugate is:\n    z* = a − bi\n\n🔑 Key Properties of the Conjugate\n    z + z* = 2a         (always real)\n    z − z* = 2bi        (always imaginary)\n    zz* = a² + b²       (always real and equal to |z|²)\n\n📌 Modulus\nThe modulus |z| is the distance from the origin to z on an Argand diagram:\n    |z| = √(a² + b²)\n\nThe modulus is never negative. It links directly to the conjugate through:\n    zz* = |z|²\n\n🔑 Division Method\nTo divide two complex numbers:\n1. Write the calculation as a single fraction\n2. Multiply top and bottom by the conjugate of the denominator\n3. Expand and simplify — the denominator becomes real\n4. Write the result in Cartesian form\n\n    (a + bi)/(c + di) = [(a + bi)(c − di)] / (c² + d²)\n\n💡 Worked Example — Division\nSimplify (1 + 7i) ÷ (3 − i).\n\n  Step 1: Write as a fraction\n    (1 + 7i)/(3 − i)\n\n  Step 2: Multiply top and bottom by (3 + i)\n    [(1 + 7i)(3 + i)] / [(3 − i)(3 + i)]\n\n  Step 3: Expand numerator and denominator\n    Numerator: 3 + i + 21i + 7i² = 3 + 22i − 7 = −4 + 22i\n    Denominator: 9 + 3i − 3i − i² = 9 + 1 = 10\n\n  Step 4: Simplify\n    (−4 + 22i)/10 = −0.4 + 2.2i\n\n💡 Worked Example — Using zz* = |z|²\nIf z = 3 + 4i, find z · z*.\n\n  Step 1: Identify a and b\n    a = 3, b = 4\n\n  Step 2: Apply the formula\n    zz* = a² + b² = 9 + 16 = 25\n\n📎 Key Points to Remember\n• The conjugate flips the sign of the imaginary part only\n• zz* always gives a real number — this is why it removes i from a denominator\n• |z₁ + z₂| is not the same as |z₁| + |z₂| in general\n\n⚠️ Common Mistake\nForgetting to multiply both numerator and denominator by the conjugate. If you only multiply the top, you have changed the value of the expression.',
    },
    {
      id: 'math-dp-complex-numbers-n3',
      heading: 'Argand Diagrams & Argument',
      body: 'An Argand diagram turns complex numbers into geometry. Once you can visualise them as points or vectors, operations like addition and multiplication become much easier to understand.\n\n📌 Argand Diagram\nA complex plane with:\n• Horizontal axis = real axis (Re)\n• Vertical axis = imaginary axis (Im)\n\nThe number z = x + iy is plotted at the point (x, y) or drawn as a vector from the origin to that point.\n\n📌 Argument arg(z)\nThe argument is the angle measured counter-clockwise from the positive real axis to the vector. It is usually given in the range:\n    −π < arg(z) ≤ π\n\nTo calculate it, first find the acute reference angle using:\n    reference angle = tan⁻¹(|y/x|)\n\nThen adjust for the quadrant:\n• Q1 (x > 0, y > 0):   arg(z) = reference angle\n• Q2 (x < 0, y > 0):   arg(z) = π − reference angle\n• Q3 (x < 0, y < 0):   arg(z) = −π + reference angle\n• Q4 (x > 0, y < 0):   arg(z) = −reference angle\n\n💡 Worked Example — Finding the Argument\nFind arg(z) for z = −1 − i.\n\n  Step 1: Identify the quadrant\n    x = −1, y = −1 → Q3\n\n  Step 2: Find the reference angle\n    tan⁻¹(1) = π/4\n\n  Step 3: Apply the Q3 rule\n    arg(z) = −π + π/4 = −3π/4\n\n🔑 Geometric Operations\n• Adding w to z translates z by the vector (Re(w), Im(w))\n• Multiplying by i rotates z 90° counter-clockwise\n• Taking the conjugate z* reflects z across the real axis\n\n💡 Worked Example — Geometry of Multiplication by i\nLet z = 2 − i. Find iz and describe the transformation.\n\n  Step 1: Multiply\n    iz = i(2 − i) = 2i − i² = 2i + 1 = 1 + 2i\n\n  Step 2: Compare on the Argand diagram\n    z = 2 − i is at (2, −1)\n    iz = 1 + 2i is at (1, 2)\n\n  Step 3: Describe\n    The point has rotated 90° counter-clockwise about the origin.\n\n📎 Key Points to Remember\n• Always sketch the point before deciding the quadrant for arg(z)\n• arg(0) is undefined — there is no angle to measure\n• A negative argument simply means the angle is measured clockwise\n\n⚠️ Common Mistake\nUsing tan⁻¹(y/x) directly without checking the quadrant. For example, tan⁻¹(−1/−1) = π/4, but the correct argument for −1 − i is −3π/4 because it lies in Q3.',
    },
    {
      id: 'math-dp-complex-numbers-n4',
      heading: 'Polar, Euler Forms & Operations',
      body: 'Polar and Euler forms package a complex number by its size (modulus) and direction (argument). These forms make multiplication, division, and powers almost effortless compared with Cartesian form.\n\n📌 Polar (cis) Form\nAny complex number can be written as:\n    z = r(cos θ + i sin θ) = r cis θ\nwhere:\n    r = |z|   (modulus)\n    θ = arg(z) (argument)\n\n📌 Euler (Exponential) Form\n    z = re^(iθ)\n\nThis reveals a deep link between exponentials and trigonometry. It is equivalent to polar form and is ideal for multiplication, division, and powers.\n\n🔑 Multiplication & Division in Polar/Euler Form\nTo multiply: multiply the moduli and add the arguments\n    z₁z₂ = r₁r₂ cis(θ₁ + θ₂)\n\nTo divide: divide the moduli and subtract the arguments\n    z₁/z₂ = (r₁/r₂) cis(θ₁ − θ₂)\n\nIf the new argument falls outside −π < θ ≤ π, add or subtract 2π to bring it back into range.\n\n🔑 De Moivre\'s Theorem\nFor powers of a complex number in polar form:\n    zⁿ = rⁿ cis(nθ)\n\n💡 Worked Example — Multiplication in Polar Form\nLet z₁ = 3 cis(π/6) and z₂ = 2 cis(π/4). Find z₁z₂.\n\n  Step 1: Multiply the moduli\n    r = 3 × 2 = 6\n\n  Step 2: Add the arguments\n    θ = π/6 + π/4 = 2π/12 + 3π/12 = 5π/12\n\n  Step 3: Write the result\n    z₁z₂ = 6 cis(5π/12)\n\n💡 Worked Example — Conversion Between Forms\nExpress z = 2 + 2i in polar form r cis θ.\n\n  Step 1: Find the modulus\n    r = √(2² + 2²) = √8 = 2√2\n\n  Step 2: Find the argument\n    Point (2, 2) is in Q1, so θ = tan⁻¹(2/2) = tan⁻¹(1) = π/4\n\n  Step 3: Write in polar form\n    z = 2√2 cis(π/4)\n\n💡 Worked Example — De Moivre\'s Theorem\nLet z = 2e^(iπ/3). Calculate z².\n\n  Step 1: Apply the theorem\n    z² = 2² e^(i · 2π/3) = 4e^(2πi/3)\n\n  Step 2: Convert to Cartesian form (optional)\n    4[cos(2π/3) + i sin(2π/3)] = 4(−1/2 + i√3/2) = −2 + 2√3 i\n\n📎 Key Points to Remember\n• Polar/Euler forms are much faster than Cartesian form for multiplication and division\n• Always check that the final argument lies in the required range\n• The conjugate of r cis θ is r cis(−θ)\n• Euler\'s identity: e^(iπ) + 1 = 0 connects the five most important numbers in mathematics\n\n⚠️ Common Mistake\nTrying to add complex numbers in polar form by adding moduli and arguments. Addition only works cleanly in Cartesian form. Convert to a + bi first, add, then convert back if needed.',
    },
  ],
  flashcards: [
    {
      id: 'math-dp-complex-numbers-f1',
      term: 'Imaginary unit i',
      definition: 'Defined by i² = −1, extending the real number system to include square roots of negatives.',
      example: '√−9 = 3i and √−7 = i√7.',
    },
    {
      id: 'math-dp-complex-numbers-f2',
      term: 'Cartesian form',
      definition: 'z = a + bi where a, b ∈ ℝ; a is the real part and b is the imaginary part.',
      example: 'For z = 5 − 2i, Re(z) = 5 and Im(z) = −2.',
    },
    {
      id: 'math-dp-complex-numbers-f3',
      term: 'Complex conjugate',
      definition: 'For z = a + bi, the conjugate is z* = a − bi.',
      example: '(3 + 4i)* = 3 − 4i; zz* = 3² + 4² = 25.',
    },
    {
      id: 'math-dp-complex-numbers-f4',
      term: 'Modulus |z|',
      definition: 'The distance from the origin to z on an Argand diagram: |z| = √(a² + b²).',
      example: '|−5 + 12i| = √(25 + 144) = 13.',
    },
    {
      id: 'math-dp-complex-numbers-f5',
      term: 'Argument arg(z)',
      definition: 'The angle from the positive real axis to z, measured counter-clockwise, usually in the range −π < arg(z) ≤ π.',
      example: 'arg(1 + i) = π/4; arg(−1 + i) = 3π/4.',
    },
    {
      id: 'math-dp-complex-numbers-f6',
      term: 'Argand diagram',
      definition: 'A geometric representation of complex numbers on a plane with real (horizontal) and imaginary (vertical) axes.',
      example: 'z = 2 + 3i is plotted at the point (2, 3).',
    },
    {
      id: 'math-dp-complex-numbers-f7',
      term: 'Polar (cis) form',
      definition: 'z = r(cos θ + i sin θ) = r cis θ, where r = |z| and θ = arg(z).',
      example: '2(cos(π/3) + i sin(π/3)) = 2 cis(π/3).',
    },
    {
      id: 'math-dp-complex-numbers-f8',
      term: 'Euler\'s form',
      definition: 'z = re^(iθ), equivalent to polar form and ideal for multiplication, division, and powers.',
      example: 'e^(iπ) = −1 and i = e^(iπ/2).',
    },
  ],
  questions: [
    {
      id: 'math-dp-complex-numbers-q1',
      stem: 'Simplify (2 + 3i)(1 − i).',
      choices: ['5 + i', '5 − i', '2 + i', '−1 + 5i'],
      correctIndex: 0,
      explanation: 'Expand: 2 − 2i + 3i − 3i² = 2 + i − 3(−1) = 5 + i.',
    },
    {
      id: 'math-dp-complex-numbers-q2',
      stem: 'What is the modulus of z = −5 + 12i?',
      choices: ['13', '√17', '√119', '17'],
      correctIndex: 0,
      explanation: '|z| = √((−5)² + 12²) = √(25 + 144) = √169 = 13.',
    },
    {
      id: 'math-dp-complex-numbers-q3',
      stem: 'Find arg(z) for z = −1 − i, giving your answer in the range −π < θ ≤ π.',
      choices: ['π/4', '−π/4', '3π/4', '−3π/4'],
      correctIndex: 3,
      explanation: 'z lies in Q3. tan⁻¹(1) = π/4, so the angle is −π + π/4 = −3π/4.',
    },
    {
      id: 'math-dp-complex-numbers-q4',
      stem: 'Solve x² + 4x + 13 = 0.',
      choices: ['−2 ± 3i', '2 ± 3i', '−4 ± 3i', '−2 ± √3 i'],
      correctIndex: 0,
      explanation: 'x = (−4 ± √(16 − 52))/2 = (−4 ± √−36)/2 = (−4 ± 6i)/2 = −2 ± 3i.',
    },
    {
      id: 'math-dp-complex-numbers-q5',
      stem: 'If z = 1 + 2i, what is z · z*?',
      choices: ['1 + 4i', '5', '−3', '1 − 4i'],
      correctIndex: 1,
      explanation: 'z* = 1 − 2i. Using zz* = a² + b², we get 1² + 2² = 5.',
    },
    {
      id: 'math-dp-complex-numbers-q6',
      stem: 'Express 2 − 2i in polar form r cis θ.',
      choices: ['2√2 cis(−π/4)', '2√2 cis(π/4)', '4 cis(−π/4)', '2 cis(−π/4)'],
      correctIndex: 0,
      explanation: 'r = √(4 + 4) = 2√2. The point (2, −2) is in Q4, so θ = −π/4.',
    },
    {
      id: 'math-dp-complex-numbers-q7',
      stem: 'Let z₁ = 3 cis(π/6) and z₂ = 2 cis(π/4). Find z₁z₂ in polar form.',
      choices: ['5 cis(5π/12)', '6 cis(5π/12)', '6 cis(−π/12)', '5 cis(π/24)'],
      correctIndex: 1,
      explanation: 'Multiply moduli: 3 × 2 = 6. Add arguments: π/6 + π/4 = 2π/12 + 3π/12 = 5π/12.',
    },
    {
      id: 'math-dp-complex-numbers-q8',
      stem: 'Which geometric transformation represents multiplication by i?',
      choices: ['Reflection in the real axis', 'Enlargement by scale factor i', 'Rotation 90° clockwise', 'Rotation 90° counter-clockwise'],
      correctIndex: 3,
      explanation: 'Multiplying by i rotates a complex number 90° counter-clockwise about the origin.',
    },
  ],
};

export default mathDpComplexNumbers;
