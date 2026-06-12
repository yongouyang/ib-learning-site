import { Topic } from './types';

const mathDpComplexNumbers: Topic = {
  id: 'math-dp-complex-numbers',
  subjectId: 'math',
  title: 'Complex Numbers',
  description: 'Cartesian form, Argand diagrams, modulus and argument, polar and Euler forms, and the geometry of complex operations.',
  ibLevel: 'DP',
  notes: [
    {
      id: "math-dp-complex-numbers-n1",
      heading: "Introduction to Complex Numbers & Cartesian Form",
      body: "Complex numbers extend the real number system so that every quadratic equation has a solution. They are built from a real part and an imaginary part linked by the special number $i$.\n\n📌 Definition of the Imaginary Unit\n$i$ is defined by the property:\n    $$i^2 = -1$$\nThis means the square root of any negative number can be rewritten:\n    $$\\sqrt{-a} = i\\sqrt{a}$$     (for $a > 0$)\n\n📌 Cartesian Form\nA complex number $z$ is written as:\n    $$z = a + bi$$\nwhere $a, b \\in \\mathbb{R}$.\n• $a = \\operatorname{Re}(z)$ is the real part\n• $b = \\operatorname{Im}(z)$ is the imaginary part\n\nTwo complex numbers are equal only when both their real parts and their imaginary parts match.\n\n🔑 Addition & Subtraction\nCombine the real and imaginary parts separately:\n    $$(a + bi) + (c + di) = (a + c) + (b + d)i$$\n    $$(a + bi) - (c + di) = (a - c) + (b - d)i$$\n\n🔑 Multiplication in Cartesian Form\nExpand just like algebraic brackets, replacing $i^2$ with $-1$:\n    $$(a + bi)(c + di) = ac + adi + bci + bdi^2$$\n    $$= (ac - bd) + (ad + bc)i$$\n\n💡 Worked Example — Multiplication\nSimplify $(2 + 3i)(1 - i)$.\n\n  Step 1: Expand the brackets\n    $$2 - 2i + 3i - 3i^2$$\n\n  Step 2: Replace $i^2$ with $-1$\n    $$2 + i - 3(-1)$$\n\n  Step 3: Simplify\n    $$2 + i + 3 = 5 + i$$\n\n🔑 Powers of $i$\nThe powers of $i$ repeat every four steps:\n    $$i^1 = i$$\n    $$i^2 = -1$$\n    $$i^3 = -i$$\n    $$i^4 = 1$$\n\nTo simplify a higher power, divide the exponent by $4$ and use the remainder:\n    $$i^{23} = i^{4 \\times 5 + 3} = (i^4)^5 \\cdot i^3 = 1^5 \\cdot (-i) = -i$$\n\n💡 Worked Example — Higher Power of $i$\nSimplify $i^{38}$.\n\n  Step 1: Divide $38$ by $4$\n    $$38 = 4 \\times 9 + 2$$, so the remainder is $2$\n\n  Step 2: Use the cycle\n    $$i^{38} = i^2 = -1$$\n\n📎 Key Points to Remember\n• Always replace $i^2$ with $-1$ before collecting terms\n• Multiplication of two complex numbers always gives another complex number\n• For higher powers of $i$, look for the remainder when dividing by $4$\n\n⚠️ Common Mistake\nWriting $\\sqrt{-a} \\cdot \\sqrt{-b} = \\sqrt{ab}$. This is only true for real numbers. With negatives:\n    $$\\sqrt{-4} \\times \\sqrt{-9} = (2i)(3i) = 6i^2 = -6$$,   not $$\\sqrt{36} = 6$$",
    },
    {
      id: "math-dp-complex-numbers-n2",
      heading: "Complex Conjugates, Division & Modulus",
      body: "The complex conjugate is a powerful tool that turns division into a simple fraction with a real denominator. It is also closely tied to the modulus, which measures the size of a complex number.\n\n📌 Complex Conjugate\nFor $z = a + bi$, the conjugate is:\n    $$z^* = a - bi$$\n\n🔑 Key Properties of the Conjugate\n    $$z + z^* = 2a \\quad \\text{(always real)}$$\n    $$z - z^* = 2bi \\quad \\text{(always imaginary)}$$\n    $$zz^* = a^2 + b^2 \\quad \\text{(always real and equal to } |z|^2\\text{)}$$\n\n📌 Modulus\nThe modulus $|z|$ is the distance from the origin to $z$ on an Argand diagram:\n    $$|z| = \\sqrt{a^2 + b^2}$$\n\nThe modulus is never negative. It links directly to the conjugate through:\n    $$zz^* = |z|^2$$\n\n🔑 Division Method\nTo divide two complex numbers:\n1. Write the calculation as a single fraction\n2. Multiply top and bottom by the conjugate of the denominator\n3. Expand and simplify — the denominator becomes real\n4. Write the result in Cartesian form\n\n    $$\\frac{a + bi}{c + di} = \\frac{(a + bi)(c - di)}{c^2 + d^2}$$\n\n💡 Worked Example — Division\nSimplify $(1 + 7i) \\div (3 - i)$.\n\n  Step 1: Write as a fraction\n    $$\\frac{1 + 7i}{3 - i}$$\n\n  Step 2: Multiply top and bottom by $(3 + i)$\n    $$\\frac{(1 + 7i)(3 + i)}{(3 - i)(3 + i)}$$\n\n  Step 3: Expand numerator and denominator\n    Numerator: $3 + i + 21i + 7i^2 = 3 + 22i - 7 = -4 + 22i$\n    Denominator: $9 + 3i - 3i - i^2 = 9 + 1 = 10$\n\n  Step 4: Simplify\n    $$\\frac{-4 + 22i}{10} = -0.4 + 2.2i$$\n\n💡 Worked Example — Using $zz^* = |z|^2$\nIf $z = 3 + 4i$, find $z \\cdot z^*$.\n\n  Step 1: Identify $a$ and $b$\n    $$a = 3, \\ b = 4$$\n\n  Step 2: Apply the formula\n    $$zz^* = a^2 + b^2 = 9 + 16 = 25$$\n\n📎 Key Points to Remember\n• The conjugate flips the sign of the imaginary part only\n• $zz^*$ always gives a real number — this is why it removes $i$ from a denominator\n• $|z_1 + z_2|$ is not the same as $|z_1| + |z_2|$ in general\n\n⚠️ Common Mistake\nForgetting to multiply both numerator and denominator by the conjugate. If you only multiply the top, you have changed the value of the expression.",
    },
    {
      id: "math-dp-complex-numbers-n3",
      heading: "Argand Diagrams & Argument",
      body: "An Argand diagram turns complex numbers into geometry. Once you can visualise them as points or vectors, operations like addition and multiplication become much easier to understand.\n\n📌 Argand Diagram\nA complex plane with:\n• Horizontal axis = real axis ($\\text{Re}$)\n• Vertical axis = imaginary axis ($\\text{Im}$)\n\nThe number $z = x + iy$ is plotted at the point $(x, y)$ or drawn as a vector from the origin to that point.\n\n📌 Argument $\\arg(z)$\nThe argument is the angle measured counter-clockwise from the positive real axis to the vector. It is usually given in the range:\n    $$-\\pi < \\arg(z) \\leq \\pi$$\n\nTo calculate it, first find the acute reference angle using:\n    $$\\text{reference angle} = \\tan^{-1}\\left(\\left|\\frac{y}{x}\\right|\\right)$$\n\nThen adjust for the quadrant:\n• Q1 ($x > 0$, $y > 0$):   $\\arg(z) = \\text{reference angle}$\n• Q2 ($x < 0$, $y > 0$):   $\\arg(z) = \\pi - \\text{reference angle}$\n• Q3 ($x < 0$, $y < 0$):   $\\arg(z) = -\\pi + \\text{reference angle}$\n• Q4 ($x > 0$, $y < 0$):   $\\arg(z) = -\\text{reference angle}$\n\n💡 Worked Example — Finding the Argument\nFind $\\arg(z)$ for $z = -1 - i$.\n\n  Step 1: Identify the quadrant\n    $x = -1$, $y = -1$ → Q3\n\n  Step 2: Find the reference angle\n    $$\\tan^{-1}(1) = \\frac{\\pi}{4}$$\n\n  Step 3: Apply the Q3 rule\n    $$\\arg(z) = -\\pi + \\frac{\\pi}{4} = -\\frac{3\\pi}{4}$$\n\n🔑 Geometric Operations\n• Adding $w$ to $z$ translates $z$ by the vector $(\\operatorname{Re}(w), \\operatorname{Im}(w))$\n• Multiplying by $i$ rotates $z$ $90^\\circ$ counter-clockwise\n• Taking the conjugate $z^*$ reflects $z$ across the real axis\n\n💡 Worked Example — Geometry of Multiplication by $i$\nLet $z = 2 - i$. Find $iz$ and describe the transformation.\n\n  Step 1: Multiply\n    $$iz = i(2 - i) = 2i - i^2 = 2i + 1 = 1 + 2i$$\n\n  Step 2: Compare on the Argand diagram\n    $z = 2 - i$ is at $(2, -1)$\n    $iz = 1 + 2i$ is at $(1, 2)$\n\n  Step 3: Describe\n    The point has rotated $90^\\circ$ counter-clockwise about the origin.\n\n📎 Key Points to Remember\n• Always sketch the point before deciding the quadrant for $\\arg(z)$\n• $\\arg(0)$ is undefined — there is no angle to measure\n• A negative argument simply means the angle is measured clockwise\n\n⚠️ Common Mistake\nUsing $\\tan^{-1}\\left(\\frac{y}{x}\\right)$ directly without checking the quadrant. For example, $\\tan^{-1}\\left(\\frac{-1}{-1}\\right) = \\frac{\\pi}{4}$, but the correct argument for $-1 - i$ is $-\\frac{3\\pi}{4}$ because it lies in Q3.",
    },
    {
      id: "math-dp-complex-numbers-n4",
      heading: "Polar, Euler Forms & Operations",
      body: "Polar and Euler forms package a complex number by its size (modulus) and direction (argument). These forms make multiplication, division, and powers almost effortless compared with Cartesian form.\n\n📌 Polar (cis) Form\nAny complex number can be written as:\n    $$z = r(\\cos \\theta + i \\sin \\theta) = r \\operatorname{cis} \\theta$$\nwhere:\n    $$r = |z| \\quad (\\text{modulus})$$\n    $$\\theta = \\arg(z) \\quad (\\text{argument})$$\n\n📌 Euler (Exponential) Form\n    $$z = r e^{i\\theta}$$\n\nThis reveals a deep link between exponentials and trigonometry. It is equivalent to polar form and is ideal for multiplication, division, and powers.\n\n🔑 Multiplication & Division in Polar/Euler Form\nTo multiply: multiply the moduli and add the arguments\n    $$z_1 z_2 = r_1 r_2 \\operatorname{cis}(\\theta_1 + \\theta_2)$$\n\nTo divide: divide the moduli and subtract the arguments\n    $$\\frac{z_1}{z_2} = \\frac{r_1}{r_2} \\operatorname{cis}(\\theta_1 - \\theta_2)$$\n\nIf the new argument falls outside $-\\pi < \\theta \\leq \\pi$, add or subtract $2\\pi$ to bring it back into range.\n\n🔑 De Moivre's Theorem\nFor powers of a complex number in polar form:\n    $$z^n = r^n \\operatorname{cis}(n\\theta)$$\n\n💡 Worked Example — Multiplication in Polar Form\nLet $z_1 = 3 \\operatorname{cis}\\left(\\frac{\\pi}{6}\\right)$ and $z_2 = 2 \\operatorname{cis}\\left(\\frac{\\pi}{4}\\right)$. Find $z_1 z_2$.\n\n  Step 1: Multiply the moduli\n    $$r = 3 \\times 2 = 6$$\n\n  Step 2: Add the arguments\n    $$\\theta = \\frac{\\pi}{6} + \\frac{\\pi}{4} = \\frac{2\\pi}{12} + \\frac{3\\pi}{12} = \\frac{5\\pi}{12}$$\n\n  Step 3: Write the result\n    $$z_1 z_2 = 6 \\operatorname{cis}\\left(\\frac{5\\pi}{12}\\right)$$\n\n💡 Worked Example — Conversion Between Forms\nExpress $z = 2 + 2i$ in polar form $r \\operatorname{cis} \\theta$.\n\n  Step 1: Find the modulus\n    $$r = \\sqrt{2^2 + 2^2} = \\sqrt{8} = 2\\sqrt{2}$$\n\n  Step 2: Find the argument\n    Point $(2, 2)$ is in Q1, so $\\theta = \\tan^{-1}\\left(\\frac{2}{2}\\right) = \\tan^{-1}(1) = \\frac{\\pi}{4}$\n\n  Step 3: Write in polar form\n    $$z = 2\\sqrt{2} \\operatorname{cis}\\left(\\frac{\\pi}{4}\\right)$$\n\n💡 Worked Example — De Moivre's Theorem\nLet $z = 2e^{i\\pi/3}$. Calculate $z^2$.\n\n  Step 1: Apply the theorem\n    $$z^2 = 2^2 e^{i \\cdot 2\\pi/3} = 4e^{2\\pi i/3}$$\n\n  Step 2: Convert to Cartesian form (optional)\n    $$4\\left[\\cos\\left(\\frac{2\\pi}{3}\\right) + i \\sin\\left(\\frac{2\\pi}{3}\\right)\\right] = 4\\left(-\\frac{1}{2} + i \\frac{\\sqrt{3}}{2}\\right) = -2 + 2\\sqrt{3} \\, i$$\n\n📎 Key Points to Remember\n• Polar/Euler forms are much faster than Cartesian form for multiplication and division\n• Always check that the final argument lies in the required range\n• The conjugate of $r \\operatorname{cis} \\theta$ is $r \\operatorname{cis}(-\\theta)$\n• Euler's identity: $$e^{i\\pi} + 1 = 0$$ connects the five most important numbers in mathematics\n\n⚠️ Common Mistake\nTrying to add complex numbers in polar form by adding moduli and arguments. Addition only works cleanly in Cartesian form. Convert to $a + bi$ first, add, then convert back if needed.",
    },
  ],
  flashcards: [
    {
      id: "math-dp-complex-numbers-f1",
      term: "Imaginary unit $i$",
      definition: "Defined by $i^2 = -1$, extending the real number system to include square roots of negatives.",
      example: "$\\sqrt{-9} = 3i$ and $\\sqrt{-7} = i\\sqrt{7}$.",
    },
    {
      id: "math-dp-complex-numbers-f2",
      term: "Cartesian form",
      definition: "$z = a + bi$ where $a, b \\in \\mathbb{R}$; $a$ is the real part and $b$ is the imaginary part.",
      example: "For $z = 5 - 2i$, $\\operatorname{Re}(z) = 5$ and $\\operatorname{Im}(z) = -2$.",
    },
    {
      id: "math-dp-complex-numbers-f3",
      term: "Complex conjugate",
      definition: "For $z = a + bi$, the conjugate is $z^* = a - bi$.",
      example: "$(3 + 4i)^* = 3 - 4i$; $zz^* = 3^2 + 4^2 = 25$.",
    },
    {
      id: "math-dp-complex-numbers-f4",
      term: "Modulus $|z|$",
      definition: "The distance from the origin to $z$ on an Argand diagram: $|z| = \\sqrt{a^2 + b^2}$.",
      example: "$|-5 + 12i| = \\sqrt{25 + 144} = 13$.",
    },
    {
      id: "math-dp-complex-numbers-f5",
      term: "Argument $\\arg(z)$",
      definition: "The angle from the positive real axis to $z$, measured counter-clockwise, usually in the range $-\\pi < \\arg(z) \\leq \\pi$.",
      example: "$\\arg(1 + i) = \\frac{\\pi}{4}$; $\\arg(-1 + i) = \\frac{3\\pi}{4}$.",
    },
    {
      id: "math-dp-complex-numbers-f6",
      term: "Argand diagram",
      definition: "A geometric representation of complex numbers on a plane with real (horizontal) and imaginary (vertical) axes.",
      example: "$z = 2 + 3i$ is plotted at the point $(2, 3)$.",
    },
    {
      id: "math-dp-complex-numbers-f7",
      term: "Polar (cis) form",
      definition: "$z = r(\\cos \\theta + i \\sin \\theta) = r \\operatorname{cis} \\theta$, where $r = |z|$ and $\\theta = \\arg(z)$.",
      example: "$2\\left(\\cos\\left(\\frac{\\pi}{3}\\right) + i \\sin\\left(\\frac{\\pi}{3}\\right)\\right) = 2 \\operatorname{cis}\\left(\\frac{\\pi}{3}\\right)$.",
    },
    {
      id: "math-dp-complex-numbers-f8",
      term: "Euler's form",
      definition: "$z = r e^{i\\theta}$, equivalent to polar form and ideal for multiplication, division, and powers.",
      example: "$e^{i\\pi} = -1$ and $i = e^{i\\pi/2}$.",
    },
  ],
  questions: [
    {
      id: "math-dp-complex-numbers-q1",
      stem: "Simplify $(2 + 3i)(1 - i)$.",
      choices: [ "$5 + i$", "$5 - i$", "$2 + i$", "$-1 + 5i$" ],
      correctIndex: 0,
      explanation: "Expand: $2 - 2i + 3i - 3i^2 = 2 + i - 3(-1) = 5 + i$.",
    },
    {
      id: "math-dp-complex-numbers-q2",
      stem: "What is the modulus of $z = -5 + 12i$?",
      choices: [ "$13$", "$\\sqrt{17}$", "$\\sqrt{119}$", "$17$" ],
      correctIndex: 0,
      explanation: "$|z| = \\sqrt{(-5)^2 + 12^2} = \\sqrt{25 + 144} = \\sqrt{169} = 13$.",
    },
    {
      id: "math-dp-complex-numbers-q3",
      stem: "Find $\\arg(z)$ for $z = -1 - i$, giving your answer in the range $-\\pi < \\theta \\leq \\pi$.",
      choices: [ "$\\frac{\\pi}{4}$", "$-\\frac{\\pi}{4}$", "$\\frac{3\\pi}{4}$", "$-\\frac{3\\pi}{4}$" ],
      correctIndex: 3,
      explanation: "$z$ lies in Q3. $\\tan^{-1}(1) = \\frac{\\pi}{4}$, so the angle is $-\\pi + \\frac{\\pi}{4} = -\\frac{3\\pi}{4}$.",
    },
    {
      id: "math-dp-complex-numbers-q4",
      stem: "Solve $x^2 + 4x + 13 = 0$.",
      choices: [ "$-2 \\pm 3i$", "$2 \\pm 3i$", "$-4 \\pm 3i$", "$-2 \\pm \\sqrt{3} \\, i$" ],
      correctIndex: 0,
      explanation: "$x = \\frac{-4 \\pm \\sqrt{16 - 52}}{2} = \\frac{-4 \\pm \\sqrt{-36}}{2} = \\frac{-4 \\pm 6i}{2} = -2 \\pm 3i$.",
    },
    {
      id: "math-dp-complex-numbers-q5",
      stem: "If $z = 1 + 2i$, what is $z \\cdot z^*$?",
      choices: [ "$1 + 4i$", "$5$", "$-3$", "$1 - 4i$" ],
      correctIndex: 1,
      explanation: "$z^* = 1 - 2i$. Using $zz^* = a^2 + b^2$, we get $1^2 + 2^2 = 5$.",
    },
    {
      id: "math-dp-complex-numbers-q6",
      stem: "Express $2 - 2i$ in polar form $r \\operatorname{cis} \\theta$.",
      choices: [ "$2\\sqrt{2} \\operatorname{cis}\\left(-\\frac{\\pi}{4}\\right)$", "$2\\sqrt{2} \\operatorname{cis}\\left(\\frac{\\pi}{4}\\right)$", "$4 \\operatorname{cis}\\left(-\\frac{\\pi}{4}\\right)$", "$2 \\operatorname{cis}\\left(-\\frac{\\pi}{4}\\right)$" ],
      correctIndex: 0,
      explanation: "$r = \\sqrt{4 + 4} = 2\\sqrt{2}$. The point $(2, -2)$ is in Q4, so $\\theta = -\\frac{\\pi}{4}$.",
    },
    {
      id: "math-dp-complex-numbers-q7",
      stem: "Let $z_1 = 3 \\operatorname{cis}\\left(\\frac{\\pi}{6}\\right)$ and $z_2 = 2 \\operatorname{cis}\\left(\\frac{\\pi}{4}\\right)$. Find $z_1 z_2$ in polar form.",
      choices: [ "$5 \\operatorname{cis}\\left(\\frac{5\\pi}{12}\\right)$", "$6 \\operatorname{cis}\\left(\\frac{5\\pi}{12}\\right)$", "$6 \\operatorname{cis}\\left(-\\frac{\\pi}{12}\\right)$", "$5 \\operatorname{cis}\\left(\\frac{\\pi}{24}\\right)$" ],
      correctIndex: 1,
      explanation: "Multiply moduli: $3 \\times 2 = 6$. Add arguments: $\\frac{\\pi}{6} + \\frac{\\pi}{4} = \\frac{2\\pi}{12} + \\frac{3\\pi}{12} = \\frac{5\\pi}{12}$.",
    },
    {
      id: "math-dp-complex-numbers-q8",
      stem: "Which geometric transformation represents multiplication by $i$?",
      choices: [ "Reflection in the real axis", "Enlargement by scale factor $i$", "Rotation $90^\\circ$ clockwise", "Rotation $90^\\circ$ counter-clockwise" ],
      correctIndex: 3,
      explanation: "Multiplying by $i$ rotates a complex number $90^\\circ$ counter-clockwise about the origin.",
    },
  ],
};

export default mathDpComplexNumbers;
