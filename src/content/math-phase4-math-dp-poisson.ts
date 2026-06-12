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
      body: 'The Poisson distribution is a discrete probability distribution that counts how many times an event occurs in a fixed interval of time or space.\n\nIt is perfect for rare, random events like emails arriving in an inbox, cars passing a speed camera, or flaws in a sheet of glass.\n\n📌 Definition\nA discrete random variable $X$ follows a Poisson distribution, written $X \\sim \\text{Po}(m)$, if:\n• Occurrences are independent of each other\n• Occurrences happen at a constant average rate $m$\n\nThere is no upper limit on how many times the event can occur.\n\n🔑 Notation\n\n$$X \\sim \\text{Po}(m)$$\n\n$m =$ average rate of occurrences for the interval\n\n💡 Worked Example\nJack uses $X \\sim \\text{Po}(6.25)$ to model the number of emails he receives during his one-hour lunch break.\n\n  Step 1: State the two assumptions\n    • Emails arrive independently (one email does not trigger another)\n    • Emails arrive at a uniform average rate of $6.25$ per hour\n\n  Step 2: Find the standard deviation\n    For a Poisson distribution, $\\text{Var}(X) = m$\n    $\\text{SD}(X) = \\sqrt{m} = \\sqrt{6.25} = 2.5$ emails\n\n📎 Key Points to Remember\n• Poisson is discrete — it counts whole occurrences only\n• There is no fixed number of trials (unlike binomial)\n• Events can theoretically keep happening forever\n• The model works for time periods or spatial areas\n\n⚠️ Common Mistake\nConfusing Poisson with binomial. Binomial needs a fixed number of trials $n$ and a probability $p$. Poisson needs only a rate $m$ and has no maximum count.',
    },
    {
      id: 'math-dp-poisson-distribution-n2',
      heading: 'The Poisson Formula and Key Properties',
      body: 'The Poisson distribution has one of the simplest formulas in statistics, yet it carries remarkably powerful properties.\n\n🔑 Probability Formula\n\n$$P(X = r) = \\frac{e^{-m} \\cdot m^r}{r!}$$\n\nfor $r = 0, 1, 2, \\ldots$\n\n  where:\n    $e \\approx 2.718$ (Euler\'s constant)\n    $m =$ mean number of occurrences\n    $r! = r \\times (r - 1) \\times \\ldots \\times 2 \\times 1$, and $0! = 1$\n\n🔑 Mean and Variance\n\n$$E(X) = m$$\n$$\\text{Var}(X) = m$$\n$$\\text{SD}(X) = \\sqrt{m}$$\n\n  This mean = variance property is unique to the Poisson distribution.\n\n🔑 Sum of Independent Poisson Variables\n\n  If $X \\sim \\text{Po}(m)$ and $Y \\sim \\text{Po}(\\lambda)$ are independent, then:\n\n$$X + Y \\sim \\text{Po}(m + \\lambda)$$\n\n  This extends to any number of independent Poisson variables.\n\n💡 Worked Example 1 — Using the Formula\nFor $X \\sim \\text{Po}(3)$, find $P(X = 2)$.\n\n  Step 1: Substitute into the formula\n\n$$P(X = 2) = \\frac{e^{-3} \\cdot 3^2}{2!}$$\n\n  Step 2: Calculate each part\n    $e^{-3} \\approx 0.0498$\n    $3^2 = 9$\n    $2! = 2$\n\n  Step 3: Combine\n\n$$P(X = 2) = \\frac{0.0498 \\times 9}{2} \\approx 0.224$$\n\n💡 Worked Example 2 — Sum Property\nCars pass a junction at an average rate of $5$ per minute. Buses pass independently at $2$ per minute. Find the distribution of total vehicles.\n\n  Step 1: Define the variables\n    $C \\sim \\text{Po}(5)$ for cars\n    $B \\sim \\text{Po}(2)$ for buses\n\n  Step 2: Apply the sum property\n\n$$C + B \\sim \\text{Po}(5 + 2) = \\text{Po}(7)$$\n\n📎 Key Points to Remember\n• Mean and variance are both equal to $m$ — always\n• The distribution is right-skewed for small $m$, becoming more symmetric as $m$ grows\n• You can add independent Poisson variables by adding their means\n• If sample mean $\\approx$ sample variance for discrete data, a Poisson model might fit\n\n⚠️ Common Mistake\nForgetting that $0! = 1$. When calculating $P(X = 0)$, the formula becomes $P(X = 0) = \\frac{e^{-m} \\cdot m^0}{0!} = e^{-m}$. Students sometimes think $m^0 = 0$ or $0! = 0$.',
    },
    {
      id: 'math-dp-poisson-distribution-n3',
      heading: 'Calculating Poisson Probabilities',
      body: 'Your GDC is the fastest way to find Poisson probabilities. Know which function to use and how to rewrite inequalities.\n\n📌 GDC Functions\n• Poisson PD (or Poisson Pdf) — finds $P(X = x)$ for a single value\n• Poisson CD (or Poisson Cdf) — finds $P(a \\leq X \\leq b)$ or $P(X \\leq x)$\n\n🔑 Converting Inequalities for Your GDC\n\n$$P(X < x) = P(X \\leq x - 1)$$\n$$P(X > x) = 1 - P(X \\leq x)$$\n$$P(X \\geq x) = 1 - P(X \\leq x - 1)$$\n$$P(a \\leq X \\leq b) = P(X \\leq b) - P(X \\leq a - 1)$$\n\n💡 Worked Example 1 — Single and Cumulative Values\nLet $X \\sim \\text{Po}(4)$. Find $P(X \\leq 2)$ and $P(X > 1)$.\n\n  Part A: $P(X \\leq 2)$\n    Use Poisson CD with $x = 2$, $m = 4$\n    $P(X \\leq 2) \\approx 0.238$\n\n  Part B: $P(X > 1)$\n    Rewrite: $P(X > 1) = 1 - P(X \\leq 1)$\n    Use Poisson CD with $x = 1$, $m = 4$\n    $P(X \\leq 1) \\approx 0.0916$\n    $P(X > 1) = 1 - 0.0916 = 0.908$\n\n💡 Worked Example 2 — Range Probability\nLet $X \\sim \\text{Po}(5)$. Find $P(2 \\leq X \\leq 4)$.\n\n  Step 1: Rewrite using cumulative probabilities\n\n$$P(2 \\leq X \\leq 4) = P(X \\leq 4) - P(X \\leq 1)$$\n\n  Step 2: Use Poisson CD\n    $P(X \\leq 4) \\approx 0.4405$\n    $P(X \\leq 1) \\approx 0.0404$\n\n  Step 3: Subtract\n\n$$P(2 \\leq X \\leq 4) \\approx 0.4405 - 0.0404 = 0.440$$\n\n📎 Key Points to Remember\n• $X$ must be a non-negative integer — no fractions or negatives\n• Strict inequalities ($<$ and $>$) differ from weak ones ($\\leq$ and $\\geq$) by exactly $1$\n• For ranges, always subtract the cumulative up to $(a - 1)$ from the cumulative up to $b$\n• If your GDC only does $P(X \\leq x)$, use the conversion identities above\n\n⚠️ Common Mistake\nUsing $P(X < x) = P(X \\leq x)$. For discrete distributions, $P(X < 5) = P(X \\leq 4)$, not $P(X \\leq 5)$. That one-integer difference is the most common source of lost marks.',
    },
    {
      id: 'math-dp-poisson-distribution-n4',
      heading: 'Modelling with the Poisson Distribution',
      body: 'Setting up a Poisson model is about translating a real-world scenario into the correct random variable and mean rate.\n\n📌 Steps to Build a Poisson Model\n1. Identify what counts as a single occurrence\n2. Determine the mean rate $m$ for the relevant interval\n3. State your random variable clearly\n4. Check that independence and constant-rate conditions hold\n\n🔑 Scaling the Mean Rate\n\n  $m$ scales linearly with time or space.\n\n  If $12$ cars pass in $5$ minutes, then in $15$ minutes:\n\n$$m = 12 \\times \\frac{15}{5} = 36$$\n\n💡 Worked Example — Scaling and Modelling\nA call centre receives $8$ calls in $30$ minutes on average.\n\n  Step 1: Define the random variable for $15$ minutes\n    Let $X$ be the number of calls in a $15$-minute period.\n\n  Step 2: Scale the mean\n    $15$ minutes is half of $30$ minutes.\n\n$$m = 8 \\times \\frac{15}{30} = 4$$\n\n  Step 3: State the distribution\n\n$$X \\sim \\text{Po}(4)$$\n\n  Step 4: Check conditions\n    • Calls are independent\n    • Calls arrive at a constant average rate\n    The model is appropriate.\n\n📎 Key Points to Remember\n• Always write "Let $X$ be the number of ..." in exam answers\n• Scale $m$ using proportion — double the time means double the mean\n• The model also works for space (e.g. flaws per square metre)\n• If events cluster or one triggers another, the model breaks down\n\n⚠️ Common Mistake\nForgetting to scale the mean when the time period changes. If the question gives a rate for one interval but asks about another, you must adjust $m$ proportionally before calculating any probabilities.',
    },
  ],
  flashcards: [
    {
      id: 'math-dp-poisson-distribution-f1',
      term: 'Poisson distribution',
      definition: 'A discrete distribution modelling the number of occurrences in a fixed interval when events are independent and occur at a constant average rate.',
      example: '$X \\sim \\text{Po}(4)$ where $X =$ number of customer arrivals per hour.',
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
      definition: '$P(X = r) = \\frac{e^{-m} \\cdot m^r}{r!}$ for $r = 0, 1, 2, \\ldots$',
      example: 'For $X \\sim \\text{Po}(3)$: $P(X = 2) = \\frac{e^{-3} \\cdot 9}{2} \\approx 0.224$.',
    },
    {
      id: 'math-dp-poisson-distribution-f4',
      term: 'Mean and variance of Poisson',
      definition: 'For $X \\sim \\text{Po}(m)$: $E(X) = m$ and $\\text{Var}(X) = m$. The standard deviation is $\\sqrt{m}$.',
      example: 'If $X \\sim \\text{Po}(9)$, then $E(X) = 9$ and $\\text{SD}(X) = 3$.',
    },
    {
      id: 'math-dp-poisson-distribution-f5',
      term: 'Sum of independent Poisson variables',
      definition: 'If $X \\sim \\text{Po}(m)$ and $Y \\sim \\text{Po}(\\lambda)$ are independent, then $X + Y \\sim \\text{Po}(m + \\lambda)$.',
      example: 'Cars $\\sim \\text{Po}(5)$ and buses $\\sim \\text{Po}(2)$ independently $\\to$ total vehicles $\\sim \\text{Po}(7)$.',
    },
    {
      id: 'math-dp-poisson-distribution-f6',
      term: 'Calculating P(X > x)',
      definition: '$P(X > x) = 1 - P(X \\leq x)$. Use the cumulative distribution function on your GDC.',
      example: '$P(X > 3) = 1 - P(X \\leq 3)$ for a Poisson variable.',
    },
    {
      id: 'math-dp-poisson-distribution-f7',
      term: 'Calculating P(a ≤ X ≤ b)',
      definition: '$P(a \\leq X \\leq b) = P(X \\leq b) - P(X \\leq a - 1)$.',
      example: '$P(2 \\leq X \\leq 5) = P(X \\leq 5) - P(X \\leq 1)$.',
    },
    {
      id: 'math-dp-poisson-distribution-f8',
      term: 'Scaling the mean rate',
      definition: 'Use proportion to adjust $m$ for different time periods or areas.',
      example: '$8$ flaws per $\\text{m}^2 \\to 24$ flaws per $3\\text{ m}^2$ ($m$ scales linearly with space or time).',
    },
  ],
  questions: [
    {
      id: 'math-dp-poisson-distribution-q1',
      stem: 'For $X \\sim \\text{Po}(2.5)$, what is $P(X = 3)$ to 3 significant figures?',
      choices: ['$0.114$', '$0.214$', '$0.256$', '$0.314$'],
      correctIndex: 1,
      explanation: '$P(X = 3) = \\frac{e^{-2.5} \\cdot 2.5^3}{3!} = \\frac{e^{-2.5} \\cdot 15.625}{6} \\approx 0.2138 \\to 0.214$.',
    },
    {
      id: 'math-dp-poisson-distribution-q2',
      stem: '$X \\sim \\text{Po}(4)$. What is $P(X \\leq 2)$?',
      choices: ['$0.0916$', '$0.143$', '$0.238$', '$0.195$'],
      correctIndex: 2,
      explanation: 'Using Poisson CD: $P(X \\leq 2) = P(0) + P(1) + P(2) = e^{-4}(1 + 4 + 8) = 13e^{-4} \\approx 0.238$.',
    },
    {
      id: 'math-dp-poisson-distribution-q3',
      stem: '$X \\sim \\text{Po}(3)$. What is $P(X > 1)$?',
      choices: ['$0.050$', '$0.199$', '$0.801$', '$0.950$'],
      correctIndex: 2,
      explanation: '$P(X > 1) = 1 - P(X \\leq 1) = 1 - [e^{-3}(1 + 3)] = 1 - 4e^{-3} \\approx 1 - 0.199 = 0.801$.',
    },
    {
      id: 'math-dp-poisson-distribution-q4',
      stem: 'A discrete random variable has mean $6$ and variance $6$. Which distribution might model it?',
      choices: ['$B(12, 0.5)$', '$B(6, 1)$', '$\\text{Po}(6)$', '$N(6, 6)$'],
      correctIndex: 2,
      explanation: 'The Poisson distribution is the only one where mean = variance = $m$. $B(12, 0.5)$ has mean $6$ but variance $3$. $N(6, 6)$ is continuous, not discrete.',
    },
    {
      id: 'math-dp-poisson-distribution-q5',
      stem: '$X \\sim \\text{Po}(2)$ and $Y \\sim \\text{Po}(5)$ are independent. What is the distribution of $X + Y$?',
      choices: ['$\\text{Po}(2)$', '$\\text{Po}(5)$', '$\\text{Po}(7)$', '$\\text{Po}(10)$'],
      correctIndex: 2,
      explanation: 'The sum of independent Poisson variables is also Poisson with mean equal to the sum of the individual means: $2 + 5 = 7$.',
    },
    {
      id: 'math-dp-poisson-distribution-q6',
      stem: 'On average, a call centre receives $8$ calls in $30$ minutes. Using a Poisson model, what is the mean number of calls in a $15$-minute period?',
      choices: ['$2$', '$4$', '$8$', '$16$'],
      correctIndex: 1,
      explanation: 'The mean scales proportionally with time. $15$ minutes is half of $30$ minutes, so $m = 8/2 = 4$.',
    },
    {
      id: 'math-dp-poisson-distribution-q7',
      stem: '$X \\sim \\text{Po}(5)$. What is $P(2 \\leq X \\leq 4)$?',
      choices: ['$0.175$', '$0.263$', '$0.351$', '$0.440$'],
      correctIndex: 3,
      explanation: '$P(2 \\leq X \\leq 4) = P(X \\leq 4) - P(X \\leq 1)$. Using Poisson CD: $P(X \\leq 4) \\approx 0.4405$ and $P(X \\leq 1) \\approx 0.0404$. Difference $\\approx 0.440$.',
    },
    {
      id: 'math-dp-poisson-distribution-q8',
      stem: '$X \\sim \\text{Po}(1.5)$. What is $P(X < 2)$?',
      choices: ['$0.105$', '$0.223$', '$0.558$', '$0.777$'],
      correctIndex: 2,
      explanation: '$P(X < 2) = P(X \\leq 1)$ because $X$ is discrete. $P(X \\leq 1) = e^{-1.5}(1 + 1.5) = 2.5e^{-1.5} \\approx 0.558$.',
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
      stem: '$X \\sim \\text{Po}(6)$. What is the standard deviation of $X$?',
      choices: ['$\\sqrt{6}$', '$6$', '$36$', '$2.45$'],
      correctIndex: 0,
      explanation: 'For $X \\sim \\text{Po}(m)$, $\\text{Var}(X) = m$, so $\\text{SD}(X) = \\sqrt{m} = \\sqrt{6}$. Note that $2.45$ is $\\sqrt{6}$ rounded, but $\\sqrt{6}$ is the exact answer.',
    },
  ],
};

export default mathDpPoissonDistribution;
