import { Topic } from './types';

const mathDpPoissonDistribution: Topic = {
  id: 'math-dp-poisson-distribution',
  subjectId: 'math',
  title: 'Poisson Distribution',
  description: 'Modelling rare events with the Poisson distribution, calculating probabilities, and using its unique mean = variance property.',
  ibLevel: 'DP',
  notes: [
    {
      id: 'math-dp-poisson-distribution-n1',
      heading: 'What is a Poisson Distribution?',
      body: 'The Poisson distribution is a discrete probability distribution that counts how many times an event occurs in a fixed interval of time or space.\n\nIt is perfect for rare, random events like emails arriving in an inbox, cars passing a speed camera, or flaws in a sheet of glass.\n\n📌 Definition\nA discrete random variable X follows a Poisson distribution, written X ~ Po(m), if:\n• Occurrences are independent of each other\n• Occurrences happen at a constant average rate m\n\nThere is no upper limit on how many times the event can occur.\n\n🔑 Notation\n    X ~ Po(m)\n    m = average rate of occurrences for the interval\n\n💡 Worked Example\nJack uses X ~ Po(6.25) to model the number of emails he receives during his one-hour lunch break.\n\n  Step 1: State the two assumptions\n    • Emails arrive independently (one email does not trigger another)\n    • Emails arrive at a uniform average rate of 6.25 per hour\n\n  Step 2: Find the standard deviation\n    For a Poisson distribution, Var(X) = m\n    SD(X) = √m = √6.25 = 2.5 emails\n\n📎 Key Points to Remember\n• Poisson is discrete — it counts whole occurrences only\n• There is no fixed number of trials (unlike binomial)\n• Events can theoretically keep happening forever\n• The model works for time periods or spatial areas\n\n⚠️ Common Mistake\nConfusing Poisson with binomial. Binomial needs a fixed number of trials n and a probability p. Poisson needs only a rate m and has no maximum count.',
    },
    {
      id: 'math-dp-poisson-distribution-n2',
      heading: 'The Poisson Formula and Key Properties',
      body: 'The Poisson distribution has one of the simplest formulas in statistics, yet it carries remarkably powerful properties.\n\n🔑 Probability Formula\n    P(X = r) = e^(−m) · m^r / r!\n    for r = 0, 1, 2, ...\n\n  where:\n    e ≈ 2.718 (Euler\'s constant)\n    m = mean number of occurrences\n    r! = r × (r − 1) × ... × 2 × 1, and 0! = 1\n\n🔑 Mean and Variance\n    E(X) = m\n    Var(X) = m\n    SD(X) = √m\n\n  This mean = variance property is unique to the Poisson distribution.\n\n🔑 Sum of Independent Poisson Variables\n    If X ~ Po(m) and Y ~ Po(λ) are independent, then:\n    X + Y ~ Po(m + λ)\n\n  This extends to any number of independent Poisson variables.\n\n💡 Worked Example 1 — Using the Formula\nFor X ~ Po(3), find P(X = 2).\n\n  Step 1: Substitute into the formula\n    P(X = 2) = e^(−3) · 3² / 2!\n\n  Step 2: Calculate each part\n    e^(−3) ≈ 0.0498\n    3² = 9\n    2! = 2\n\n  Step 3: Combine\n    P(X = 2) = 0.0498 × 9 / 2 ≈ 0.224\n\n💡 Worked Example 2 — Sum Property\nCars pass a junction at an average rate of 5 per minute. Buses pass independently at 2 per minute. Find the distribution of total vehicles.\n\n  Step 1: Define the variables\n    C ~ Po(5) for cars\n    B ~ Po(2) for buses\n\n  Step 2: Apply the sum property\n    C + B ~ Po(5 + 2) = Po(7)\n\n📎 Key Points to Remember\n• Mean and variance are both equal to m — always\n• The distribution is right-skewed for small m, becoming more symmetric as m grows\n• You can add independent Poisson variables by adding their means\n• If sample mean ≈ sample variance for discrete data, a Poisson model might fit\n\n⚠️ Common Mistake\nForgetting that 0! = 1. When calculating P(X = 0), the formula becomes P(X = 0) = e^(−m) · m^0 / 0! = e^(−m) · 1 / 1 = e^(−m). Students sometimes think m^0 = 0 or 0! = 0.',
    },
    {
      id: 'math-dp-poisson-distribution-n3',
      heading: 'Calculating Poisson Probabilities',
      body: 'Your GDC is the fastest way to find Poisson probabilities. Know which function to use and how to rewrite inequalities.\n\n📌 GDC Functions\n• Poisson PD (or Poisson Pdf) — finds P(X = x) for a single value\n• Poisson CD (or Poisson Cdf) — finds P(a ≤ X ≤ b) or P(X ≤ x)\n\n🔑 Converting Inequalities for Your GDC\n\n    P(X < x) = P(X ≤ x − 1)\n    P(X > x) = 1 − P(X ≤ x)\n    P(X ≥ x) = 1 − P(X ≤ x − 1)\n    P(a ≤ X ≤ b) = P(X ≤ b) − P(X ≤ a − 1)\n\n💡 Worked Example 1 — Single and Cumulative Values\nLet X ~ Po(4). Find P(X ≤ 2) and P(X > 1).\n\n  Part A: P(X ≤ 2)\n    Use Poisson CD with x = 2, m = 4\n    P(X ≤ 2) ≈ 0.238\n\n  Part B: P(X > 1)\n    Rewrite: P(X > 1) = 1 − P(X ≤ 1)\n    Use Poisson CD with x = 1, m = 4\n    P(X ≤ 1) ≈ 0.0916\n    P(X > 1) = 1 − 0.0916 = 0.908\n\n💡 Worked Example 2 — Range Probability\nLet X ~ Po(5). Find P(2 ≤ X ≤ 4).\n\n  Step 1: Rewrite using cumulative probabilities\n    P(2 ≤ X ≤ 4) = P(X ≤ 4) − P(X ≤ 1)\n\n  Step 2: Use Poisson CD\n    P(X ≤ 4) ≈ 0.4405\n    P(X ≤ 1) ≈ 0.0404\n\n  Step 3: Subtract\n    P(2 ≤ X ≤ 4) ≈ 0.4405 − 0.0404 = 0.440\n\n📎 Key Points to Remember\n• X must be a non-negative integer — no fractions or negatives\n• Strict inequalities (< and >) differ from weak ones (≤ and ≥) by exactly 1\n• For ranges, always subtract the cumulative up to (a − 1) from the cumulative up to b\n• If your GDC only does P(X ≤ x), use the conversion identities above\n\n⚠️ Common Mistake\nUsing P(X < x) = P(X ≤ x). For discrete distributions, P(X < 5) = P(X ≤ 4), not P(X ≤ 5). That one-integer difference is the most common source of lost marks.',
    },
    {
      id: 'math-dp-poisson-distribution-n4',
      heading: 'Modelling with the Poisson Distribution',
      body: 'Setting up a Poisson model is about translating a real-world scenario into the correct random variable and mean rate.\n\n📌 Steps to Build a Poisson Model\n1. Identify what counts as a single occurrence\n2. Determine the mean rate m for the relevant interval\n3. State your random variable clearly\n4. Check that independence and constant-rate conditions hold\n\n🔑 Scaling the Mean Rate\n    m scales linearly with time or space.\n\n    If 12 cars pass in 5 minutes, then in 15 minutes:\n    m = 12 × (15 / 5) = 36\n\n💡 Worked Example — Scaling and Modelling\nA call centre receives 8 calls in 30 minutes on average.\n\n  Step 1: Define the random variable for 15 minutes\n    Let X be the number of calls in a 15-minute period.\n\n  Step 2: Scale the mean\n    15 minutes is half of 30 minutes.\n    m = 8 × (15 / 30) = 4\n\n  Step 3: State the distribution\n    X ~ Po(4)\n\n  Step 4: Check conditions\n    • Calls are independent\n    • Calls arrive at a constant average rate\n    The model is appropriate.\n\n📎 Key Points to Remember\n• Always write "Let X be the number of ..." in exam answers\n• Scale m using proportion — double the time means double the mean\n• The model also works for space (e.g. flaws per square metre)\n• If events cluster or one triggers another, the model breaks down\n\n⚠️ Common Mistake\nForgetting to scale the mean when the time period changes. If the question gives a rate for one interval but asks about another, you must adjust m proportionally before calculating any probabilities.',
    },
  ],
  flashcards: [
    {
      id: 'math-dp-poisson-distribution-f1',
      term: 'Poisson distribution',
      definition: 'A discrete distribution modelling the number of occurrences in a fixed interval when events are independent and occur at a constant average rate.',
      example: 'X ~ Po(4) where X = number of customer arrivals per hour.',
    },
    {
      id: 'math-dp-poisson-distribution-f2',
      term: 'Conditions for a Poisson model',
      definition: 'Occurrences must be independent and occur at a uniform average rate for the interval.',
      example: 'Phone calls to a switchboard — each call is independent and arrives at a steady average rate.',
    },
    {
      id: 'math-dp-poisson-distribution-f3',
      term: 'Poisson probability formula',
      definition: 'P(X = r) = e^(−m) · m^r / r! for r = 0, 1, 2, ...',
      example: 'For X ~ Po(3): P(X = 2) = e^(−3) · 9 / 2 ≈ 0.224.',
    },
    {
      id: 'math-dp-poisson-distribution-f4',
      term: 'Mean and variance of Poisson',
      definition: 'For X ~ Po(m): E(X) = m and Var(X) = m. The standard deviation is √m.',
      example: 'If X ~ Po(9), then E(X) = 9 and SD(X) = 3.',
    },
    {
      id: 'math-dp-poisson-distribution-f5',
      term: 'Sum of independent Poisson variables',
      definition: 'If X ~ Po(m) and Y ~ Po(λ) are independent, then X + Y ~ Po(m + λ).',
      example: 'Cars ~ Po(5) and buses ~ Po(2) independently → total vehicles ~ Po(7).',
    },
    {
      id: 'math-dp-poisson-distribution-f6',
      term: 'Calculating P(X > x)',
      definition: 'P(X > x) = 1 − P(X ≤ x). Use the cumulative distribution function on your GDC.',
      example: 'P(X > 3) = 1 − P(X ≤ 3) for a Poisson variable.',
    },
    {
      id: 'math-dp-poisson-distribution-f7',
      term: 'Calculating P(a ≤ X ≤ b)',
      definition: 'P(a ≤ X ≤ b) = P(X ≤ b) − P(X ≤ a − 1).',
      example: 'P(2 ≤ X ≤ 5) = P(X ≤ 5) − P(X ≤ 1).',
    },
    {
      id: 'math-dp-poisson-distribution-f8',
      term: 'Scaling the mean rate',
      definition: 'Use proportion to adjust m for different time periods or areas.',
      example: '8 flaws per m² → 24 flaws per 3 m² (m scales linearly with space or time).',
    },
  ],
  questions: [
    {
      id: 'math-dp-poisson-distribution-q1',
      stem: 'For X ~ Po(2.5), what is P(X = 3) to 3 significant figures?',
      choices: ['0.114', '0.214', '0.256', '0.314'],
      correctIndex: 1,
      explanation: 'P(X = 3) = e^(−2.5) · 2.5³ / 3! = e^(−2.5) · 15.625 / 6 ≈ 0.2138 → 0.214.',
    },
    {
      id: 'math-dp-poisson-distribution-q2',
      stem: 'X ~ Po(4). What is P(X ≤ 2)?',
      choices: ['0.0916', '0.143', '0.238', '0.195'],
      correctIndex: 2,
      explanation: 'Using Poisson CD: P(X ≤ 2) = P(0) + P(1) + P(2) = e^(−4)(1 + 4 + 8) = 13e^(−4) ≈ 0.238.',
    },
    {
      id: 'math-dp-poisson-distribution-q3',
      stem: 'X ~ Po(3). What is P(X > 1)?',
      choices: ['0.050', '0.199', '0.801', '0.950'],
      correctIndex: 2,
      explanation: 'P(X > 1) = 1 − P(X ≤ 1) = 1 − [e^(−3)(1 + 3)] = 1 − 4e^(−3) ≈ 1 − 0.199 = 0.801.',
    },
    {
      id: 'math-dp-poisson-distribution-q4',
      stem: 'A discrete random variable has mean 6 and variance 6. Which distribution might model it?',
      choices: ['B(12, 0.5)', 'B(6, 1)', 'Po(6)', 'N(6, 6)'],
      correctIndex: 2,
      explanation: 'The Poisson distribution is the only one where mean = variance = m. B(12, 0.5) has mean 6 but variance 3. N(6, 6) is continuous, not discrete.',
    },
    {
      id: 'math-dp-poisson-distribution-q5',
      stem: 'X ~ Po(2) and Y ~ Po(5) are independent. What is the distribution of X + Y?',
      choices: ['Po(2)', 'Po(5)', 'Po(7)', 'Po(10)'],
      correctIndex: 2,
      explanation: 'The sum of independent Poisson variables is also Poisson with mean equal to the sum of the individual means: 2 + 5 = 7.',
    },
    {
      id: 'math-dp-poisson-distribution-q6',
      stem: 'On average, a call centre receives 8 calls in 30 minutes. Using a Poisson model, what is the mean number of calls in a 15-minute period?',
      choices: ['2', '4', '8', '16'],
      correctIndex: 1,
      explanation: 'The mean scales proportionally with time. 15 minutes is half of 30 minutes, so m = 8/2 = 4.',
    },
    {
      id: 'math-dp-poisson-distribution-q7',
      stem: 'X ~ Po(5). What is P(2 ≤ X ≤ 4)?',
      choices: ['0.175', '0.263', '0.351', '0.440'],
      correctIndex: 3,
      explanation: 'P(2 ≤ X ≤ 4) = P(X ≤ 4) − P(X ≤ 1). Using Poisson CD: P(X ≤ 4) ≈ 0.4405 and P(X ≤ 1) ≈ 0.0404. Difference ≈ 0.440.',
    },
    {
      id: 'math-dp-poisson-distribution-q8',
      stem: 'X ~ Po(1.5). What is P(X < 2)?',
      choices: ['0.105', '0.223', '0.558', '0.777'],
      correctIndex: 2,
      explanation: 'P(X < 2) = P(X ≤ 1) because X is discrete. P(X ≤ 1) = e^(−1.5)(1 + 1.5) = 2.5e^(−1.5) ≈ 0.558.',
    },
    {
      id: 'math-dp-poisson-distribution-q9',
      stem: 'Which of the following is NOT a valid reason to use a Poisson distribution?',
      choices: ['Events occur at a constant average rate', 'Events are independent', 'There is a fixed maximum number of trials', 'The mean and variance are approximately equal'],
      correctIndex: 2,
      explanation: 'Poisson does NOT require a fixed number of trials — that is a feature of the binomial distribution. Poisson events can theoretically occur without limit.',
    },
    {
      id: 'math-dp-poisson-distribution-q10',
      stem: 'X ~ Po(6). What is the standard deviation of X?',
      choices: ['√6', '6', '36', '2.45'],
      correctIndex: 0,
      explanation: 'For X ~ Po(m), Var(X) = m, so SD(X) = √m = √6. Note that 2.45 is √6 rounded, but √6 is the exact answer.',
    },
  ],
};

export default mathDpPoissonDistribution;
