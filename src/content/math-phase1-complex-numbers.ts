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
      body: 'The imaginary unit i is defined by i² = −1, allowing us to take square roots of negative numbers: √−a = i√a (a > 0). A complex number z is written in Cartesian form as z = a + bi, where a, b ∈ ℝ. We call a = Re(z) the real part and b = Im(z) the imaginary part. Two complex numbers are equal only when both their real and imaginary parts match. Addition and subtraction combine like terms: (a + bi) + (c + di) = (a + c) + (b + d)i. Multiplication follows the same rules as expanding brackets, always replacing i² with −1: (a + bi)(c + di) = (ac − bd) + (ad + bc)i. Powers of i cycle every four: i¹ = i, i² = −1, i³ = −i, i⁴ = 1, which is useful for simplifying higher powers such as i²³ = −i.',
    },
    {
      id: 'math-dp-complex-numbers-n2',
      heading: 'Complex Conjugates, Division & Modulus',
      body: 'For z = a + bi, the complex conjugate is z* = a − bi. Key properties: z + z* = 2a (always real), z − z* = 2bi (always imaginary), and zz* = a² + b² (always real and equal to |z|²). The modulus |z| = √(a² + b²) represents the distance from the origin on an Argand diagram and is never negative. To divide two complex numbers, write the calculation as a fraction and multiply the numerator and denominator by the conjugate of the denominator: (a + bi)/(c + di) = [(a + bi)(c − di)]/(c² + d²). This always produces a real denominator, giving a clean Cartesian form result. Your GDC can check these operations, but you must show the algebraic method in exams.',
    },
    {
      id: 'math-dp-complex-numbers-n3',
      heading: 'Argand Diagrams & Argument',
      body: 'An Argand diagram plots complex numbers on a plane with a horizontal real axis and vertical imaginary axis. The number z = x + iy corresponds to the point (x, y) or a vector from the origin. The argument arg(z) is the angle measured counter-clockwise from the positive real axis, usually given in the range −π < arg(z) ≤ π. Calculate it using tan⁻¹(|y/x|), but always sketch the point first to choose the correct quadrant: Q1 gives a positive acute angle, Q2 gives π − acute, Q3 gives −π + acute (or −π + acute), and Q4 gives a negative acute angle. Geometrically, adding w to z translates z by the vector (Re(w), Im(w)); multiplying by i rotates the vector 90° counter-clockwise; and taking the conjugate reflects the point across the real axis.',
    },
    {
      id: 'math-dp-complex-numbers-n4',
      heading: 'Polar, Euler Forms & Operations',
      body: 'Any complex number can be written in modulus-argument (polar) form: z = r(cos θ + i sin θ) = r cis θ, where r = |z| and θ = arg(z). Euler\'s form captures this as z = re^(iθ), revealing a deep link between exponentials and trigonometry. These forms make multiplication and division simple: to multiply, multiply the moduli and add the arguments (z₁z₂ = r₁r₂ cis(θ₁ + θ₂)); to divide, divide the moduli and subtract the arguments (z₁/z₂ = (r₁/r₂) cis(θ₁ − θ₂)). If the resulting argument falls outside the standard range, add or subtract 2π to bring it back in. For powers, De Moivre\'s theorem gives zⁿ = rⁿ cis(nθ). The famous Euler identity e^(iπ) + 1 = 0 connects the five most important numbers in mathematics.',
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
