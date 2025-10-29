// This file contains the main application logic.
// It assumes `data.js` is loaded before this file.
// رابط البيانات من GitHub
const GITHUB_DATA_URL = 'https://amedattia2026.github.io/net/data.js';

// تحميل البيانات (مع الكاش المحلي)
async function loadQuizData() {
    try {
        // 1. لو في نسخة محلية مسبقة -> نقرأها
        const cachedData = localStorage.getItem('quizData');
        if (cachedData) {
            window.quizData = JSON.parse(cachedData);
        }

        // 2. نحاول نجيب نسخة جديدة من الإنترنت
        const response = await fetch(GITHUB_DATA_URL, { cache: "no-store" });
        if (!response.ok) throw new Error('فشل تحميل البيانات من GitHub');
        
        const freshData = await response.json();

        // 3. لو البيانات الجديدة مختلفة -> نحدّث التخزين المحلي
        if (JSON.stringify(freshData) !== cachedData) {
            localStorage.setItem('quizData', JSON.stringify(freshData));
            window.quizData = freshData;
            console.log("✅ تم تحديث البيانات من الإنترنت");
        } else {
            console.log("ℹ️ لا يوجد تحديث جديد للبيانات");
        }
    } catch (error) {
        console.warn("⚠️ تعذر الوصول للإنترنت، استخدام البيانات المخزنة محليًا:", error);
    }
}

// --- GLOBAL STATE & DOM ELEMENTS ---
const currentQuiz = {
    tutorial: 'tutorial-1',
    incorrectAnswers: []
};
const incorrectAnswers = new Map(); // Using a Map to easily manage unique incorrect answers.

const sidebar = document.getElementById('sidebar');
const hamburgerMenu = document.getElementById('hamburger-menu');
const sidebarBackdrop = document.getElementById('sidebar-backdrop');
const navItemsContainer = document.querySelector('.sidebar-nav-container'); // Container for nav items
const sectionsContainer = document.querySelector('.main-container'); // Main container for sections
const headerTitle = document.getElementById('header-title'); // Reference to the header title
const currentTutorialTitle = document.getElementById('current-tutorial-title'); // NEW: Reference for the current tutorial title

// Get the fixed header and its height
const header = document.querySelector('header');
let headerHeight = 0; // Initialize height to 0


// --- LOCAL STORAGE FUNCTIONS ---

// Saves the current state (incorrect answers, current tutorial) to localStorage.
function saveQuizState() {
    localStorage.setItem('incorrectAnswers', JSON.stringify(Array.from(incorrectAnswers.entries())));
    localStorage.setItem('currentQuiz', JSON.stringify(currentQuiz));
}

// Loads the state from localStorage when the page loads.
function loadQuizState() {
    const storedIncorrectAnswers = localStorage.getItem('incorrectAnswers');
    const storedCurrentQuiz = localStorage.getItem('currentQuiz');

    if (storedIncorrectAnswers) {
        const parsedIncorrect = new Map(JSON.parse(storedIncorrectAnswers));
        for (const [key, value] of parsedIncorrect) {
            incorrectAnswers.set(key, value);
        }
    }

    if (storedCurrentQuiz) {
        const parsedCurrent = JSON.parse(storedCurrentQuiz);
        currentQuiz.tutorial = parsedCurrent.tutorial || 'tutorial-1'; // Fallback
        currentQuiz.incorrectAnswers = parsedCurrent.incorrectAnswers || [];
    }
}

// --- QUIZ RENDERING & LOGIC ---

// Gets the correct container ID for a given tutorial key.
function getContainerId(tutorialKey) {
    return `${tutorialKey}-container`;
}

// Dynamically creates an HTML card for a single question.
function createQuestionCard(questionObj, questionIndex, tutorialKey, isReviewMode = false) {
    const card = document.createElement('div');
    card.className = 'card';
    card.dataset.questionIndex = questionIndex;
    card.dataset.tutorialKey = tutorialKey;

    const questionText = document.createElement('p');
    questionText.className = 'question-text';
    questionText.textContent = questionObj.q;
    card.appendChild(questionText);

    if (questionObj.type === 'mcq') {
        const optionsContainer = document.createElement('div');
        optionsContainer.className = 'options-container';

        questionObj.options.forEach((optionText, optionIndex) => {
            const option = document.createElement('div');
            option.className = 'mcq-option';
            option.setAttribute('role', 'radio');
            option.setAttribute('aria-checked', 'false');
            option.setAttribute('tabindex', '0');
            option.dataset.optionIndex = optionIndex;
            
            const input = document.createElement('input');
            input.type = 'radio';
            input.name = `mcq-${tutorialKey}-${questionIndex}`;
            input.value = optionIndex;
            input.id = `mcq-${tutorialKey}-${questionIndex}-${optionIndex}`;
            
            const label = document.createElement('label');
            label.htmlFor = `mcq-${tutorialKey}-${questionIndex}-${optionIndex}`;
            label.textContent = optionText;

            option.appendChild(input);
            option.appendChild(label);
            optionsContainer.appendChild(option);

            // If in review mode, highlight the user's previous incorrect answer and the correct answer.
            if (isReviewMode) {
                const incorrectQuestion = Array.from(incorrectAnswers.values()).find(item =>
                    item.tutorialKey === tutorialKey && item.questionIndex === questionIndex
                );

                // If user skipped (answer is null), or chose wrong, highlight their choice
                if (incorrectQuestion) {
                    if (incorrectQuestion.userAnswer !== null && parseInt(incorrectQuestion.userAnswer) === optionIndex) {
                        option.classList.add('selected-for-review', 'option-incorrect-highlight');
                    }
                    // Always highlight the correct answer in review mode
                    if (questionObj.correct === optionIndex) {
                        option.classList.add('option-correct-highlight');
                    }
                }
            }
        });
        card.appendChild(optionsContainer);
    }

    // In review mode, we don't need a check button per card.
    if (!isReviewMode) {
        const checkButton = document.createElement('button');
        checkButton.className = 'action-button check-button';
        checkButton.textContent = 'عرض الإجابة';
        card.appendChild(checkButton);
    }

    const feedback = document.createElement('div');
    feedback.className = 'answer-text';
    card.appendChild(feedback);

    return card;
}

// Clears the quiz container before rendering new questions.
function clearQuizContainer(containerId) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    const tutorialKey = containerId.replace('-container', '');

    const showAllButton = document.getElementById(`show-all-${tutorialKey}`);
    const scoreDisplay = document.getElementById(`${tutorialKey}-score-display`);
    const finalScoreMessage = document.getElementById(`${tutorialKey}-final-score-message`);
    const reviewButton = document.getElementById(`review-incorrect-button-${tutorialKey}`);
    const retakeButton = document.getElementById(`retake-button-${tutorialKey}`);

    if (showAllButton) showAllButton.style.display = 'block';
    if (scoreDisplay) scoreDisplay.textContent = '';
    if (finalScoreMessage) {
        finalScoreMessage.textContent = '';
        finalScoreMessage.classList.add('hidden');
    }
    if (reviewButton) reviewButton.classList.add('hidden');
    if (retakeButton) retakeButton.classList.add('hidden');
}

// Main function to render a quiz based on the selected tutorial.
function renderQuiz(tutorialKey, isReviewMode = false) {
    const containerId = getContainerId(tutorialKey);
    showSection(`${tutorialKey}-section`);

    clearQuizContainer(containerId);

    const container = document.getElementById(containerId);
    const questions = isReviewMode ? Array.from(incorrectAnswers.values()).filter(item => item.tutorialKey === tutorialKey) : quizData[tutorialKey]?.data || [];

    if (questions.length === 0 && isReviewMode) {
          container.innerHTML = `<p class="text-center text-lg">لا توجد إجابات خاطئة لمراجعتها. عمل رائع!</p>`;
    } else {
          questions.forEach((questionData, index) => {
            const qIndex = isReviewMode ? questionData.questionIndex : index;
            const qObj = isReviewMode ? questionData.question : questionData;
            const tKey = isReviewMode ? questionData.tutorialKey : tutorialKey;

            const card = createQuestionCard(qObj, qIndex, tKey, isReviewMode);
            container.appendChild(card);

            // If in review mode, show the correct answer and feedback.
            if (isReviewMode) {
                showAnswer(card, qObj, true);
            }
        });
    }

    const showAllButton = document.getElementById(`show-all-${tutorialKey}`);
    const reviewButton = document.getElementById(`review-incorrect-button-${tutorialKey}`);
    const retakeButton = document.getElementById(`retake-button-${tutorialKey}`);

    if (showAllButton) {
        showAllButton.classList.toggle('hidden', isReviewMode);
    }
    // Toggle visibility of review and retake buttons based on mode
    if (reviewButton) {
        reviewButton.classList.toggle('hidden', isReviewMode);
    }
    if (retakeButton) {
        retakeButton.classList.toggle('hidden', !isReviewMode);
    }

    container.querySelectorAll('.check-button').forEach(button => {
        button.addEventListener('click', (e) => {
            const card = e.target.closest('.card');
            const tutorial = card.dataset.tutorialKey;
            const index = parseInt(card.dataset.questionIndex);
            const questionObj = quizData[tutorial].data[index];
            showAnswer(card, questionObj);
        });
    });

    container.querySelectorAll('.mcq-option').forEach(option => {
        option.addEventListener('click', () => {
            const radio = option.querySelector('input[type="radio"]');
            if (radio) {
                radio.checked = true;
                option.setAttribute('aria-checked', 'true');
                const otherOptions = option.closest('.options-container').querySelectorAll('.mcq-option');
                otherOptions.forEach(other => {
                    if (other !== option) {
                        other.setAttribute('aria-checked', 'false');
                    }
                });
            }
        });
    });
}

// Checks a single answer and provides immediate feedback.
function showAnswer(card, questionObj, isReviewMode = false) {
    const selectedOption = card.querySelector('input[type="radio"]:checked');
    const feedbackElement = card.querySelector('.answer-text');
    const options = card.querySelectorAll('.mcq-option');

    options.forEach(option => {
        option.classList.remove('option-correct-highlight', 'option-incorrect-highlight');
    });

    const correctOption = options[questionObj.correct];
    if (correctOption) {
        correctOption.classList.add('option-correct-highlight');
    }

    if (selectedOption) {
        const selectedAnswerIndex = parseInt(selectedOption.value);
        const isCorrect = selectedAnswerIndex === questionObj.correct;

        if (!isCorrect) {
            const selectedOptionElement = options[selectedAnswerIndex];
            if (selectedOptionElement) {
                selectedOptionElement.classList.add('option-incorrect-highlight');
            }
        }

        feedbackElement.style.display = 'block';
        if (isCorrect) {
            feedbackElement.innerHTML = `<span class="correct-answer-highlight">🎉 Correct answer</span>`;
        } else {
            feedbackElement.innerHTML = `<span class="incorrect-answer-highlight">❌ ${questionObj.options[questionObj.correct]}</span>`;
        }

    } else {
        feedbackElement.style.display = 'block';
        feedbackElement.innerHTML = `<span class="incorrect-answer-highlight">الإجابة الصحيحة هي: ${questionObj.options[questionObj.correct]}</span>`;
    }

    if (isReviewMode) {
        const incorrectQuestion = Array.from(incorrectAnswers.values()).find(item =>
            item.tutorialKey === card.dataset.tutorialKey && item.questionIndex === parseInt(card.dataset.questionIndex)
        );
        if (incorrectQuestion && incorrectQuestion.userAnswer !== null) {
            const selectedOptionElement = card.querySelector(`.mcq-option input[value="${incorrectQuestion.userAnswer}"]`)?.closest('.mcq-option');
            if (selectedOptionElement) {
                selectedOptionElement.classList.add('option-incorrect-highlight');
            }
        }
    }
}

// Checks all answers and calculates the score.
function checkAnswers(tutorialKey) {
    const container = document.getElementById(getContainerId(tutorialKey));
    const questions = quizData[tutorialKey].data;
    let score = 0;
    
    const keysToRemove = Array.from(incorrectAnswers.keys()).filter(key => key.startsWith(tutorialKey));
    keysToRemove.forEach(key => incorrectAnswers.delete(key));

    questions.forEach((questionObj, index) => {
        const card = container.querySelector(`.card[data-question-index="${index}"]`);
        const selectedOption = card.querySelector('input[type="radio"]:checked');

        const isCorrect = selectedOption && parseInt(selectedOption.value) === questionObj.correct;
        const incorrectKey = `${tutorialKey}-${index}`;

        if (isCorrect) {
            score++;
        } else {
            incorrectAnswers.set(incorrectKey, {
                tutorialKey: tutorialKey,
                questionIndex: index,
                question: questionObj,
                userAnswer: selectedOption ? selectedOption.value : null
            });
        }
    });

    const scoreDisplay = document.getElementById(`${tutorialKey}-score-display`);
    scoreDisplay.textContent = `أنت حصلت على ${score} من ${questions.length}.`;
    
    const finalScoreMessage = document.getElementById(`${tutorialKey}-final-score-message`);
    const reviewButton = document.getElementById(`review-incorrect-button-${tutorialKey}`);
    const retakeButton = document.getElementById(`retake-button-${tutorialKey}`);
    
    if (score === questions.length) {
        finalScoreMessage.textContent = 'عمل رائع! جميع الإجابات صحيحة!';
        finalScoreMessage.classList.remove('hidden');
        reviewButton.classList.add('hidden');
    } else {
        finalScoreMessage.textContent = `لديك ${questions.length - score} إجابات خاطئة.`;
        finalScoreMessage.classList.remove('hidden');
        reviewButton.classList.remove('hidden');
    }
    // Ensure the retake button is always hidden after submitting the quiz
    if (retakeButton) {
        retakeButton.classList.add('hidden');
    }

    saveQuizState();
}

// Displays correct answers for all questions on the page.
function showAllAnswers(tutorialKey) {
    checkAnswers(tutorialKey);
    const container = document.getElementById(getContainerId(tutorialKey));
    const questionCards = container.querySelectorAll('.card');
    
    questionCards.forEach(card => {
        const index = parseInt(card.dataset.questionIndex);
        const questionObj = quizData[tutorialKey].data[index];
        showAnswer(card, questionObj);
    });

    const showAllButton = document.getElementById(`show-all-${tutorialKey}`);
    if (showAllButton) {
        showAllButton.style.display = 'none';
    }
}


// --- UI & NAVIGATION ---

// Dynamically creates navigation items and sections based on quizData.
function buildDynamicUI() {
    navItemsContainer.innerHTML = '';
    sectionsContainer.innerHTML = '';

    // Set the course title in the header
    headerTitle.textContent = quizData.courseTitle || 'منصة تعليمية';

    const tutorialKeys = Object.keys(quizData).filter(key => key !== 'courseTitle');

    tutorialKeys.forEach(key => {
        // Create navigation item
        const navItem = document.createElement('div');
        navItem.className = 'sidebar-nav-item';
        navItem.dataset.section = key;
        navItem.textContent = quizData[key].title || key.replace(/-/g, ' ').toUpperCase(); // Use title from data or default
        navItemsContainer.appendChild(navItem);

        // Create section
        const section = document.createElement('section');
        section.id = `${key}-section`;
        section.className = 'question-section hidden';

        const quizContainer = document.createElement('div');
        quizContainer.id = `${key}-container`;
        section.appendChild(quizContainer);

        const actionsContainer = document.createElement('div');
        actionsContainer.className = 'text-center';
        actionsContainer.innerHTML = `
            <button id="show-all-${key}" class="action-button mx-auto">تقييم الإجابات</button>
            <div id="${key}-score-display" class="score-display mt-4"></div>
            <div id="${key}-final-score-message" class="final-score-message hidden"></div>
            <button id="review-incorrect-button-${key}" class="action-button mt-4 hidden mx-auto">مراجعة الإجابات الخاطئة</button>
            <button id="retake-button-${key}" class="action-button mt-4 hidden mx-auto">إعادة الاختبار</button>
        `;
        section.appendChild(actionsContainer);
        sectionsContainer.appendChild(section);
    });

    // Re-attach event listeners to new elements
    attachEventListeners();
}

// Attach all necessary event listeners.
function attachEventListeners() {
    // Sidebar navigation
    document.querySelectorAll('.sidebar-nav-item').forEach(item => {
        item.addEventListener('click', () => {
            const sectionKey = item.dataset.section;
            // Now we simply show the section without any scrolling logic
            setActiveNavItem(sectionKey);
            currentQuiz.tutorial = sectionKey;
            
            // Update the tutorial title display
            const tutorialTitle = quizData[sectionKey]?.title || sectionKey.replace(/-/g, ' ').toUpperCase();
            currentTutorialTitle.textContent = tutorialTitle;
            
            renderQuiz(sectionKey, false);
            
            sidebar.classList.remove('active');
            sidebarBackdrop.classList.remove('active');
        });
    });

    // 'Show All' buttons
    document.querySelectorAll('[id^="show-all-"]').forEach(button => {
        button.addEventListener('click', () => {
            const tutorialKey = button.id.replace('show-all-', '');
            showAllAnswers(tutorialKey);
        });
    });

    // 'Review Incorrect' buttons
    document.querySelectorAll('[id^="review-incorrect-button-"]').forEach(button => {
        button.addEventListener('click', () => {
            const tutorialKey = button.id.replace('review-incorrect-button-', '');
            const incorrectQuestions = Array.from(incorrectAnswers.values()).filter(item => item.tutorialKey === tutorialKey);
            if (incorrectQuestions.length > 0) {
                renderQuiz(tutorialKey, true);
            }
        });
    });

    // 'Retake Quiz' button
    document.querySelectorAll('[id^="retake-button-"]').forEach(button => {
        button.addEventListener('click', () => {
            const tutorialKey = button.id.replace('retake-button-', '');
            // Clear all incorrect answers for this tutorial from local storage and the map
            const keysToRemove = Array.from(incorrectAnswers.keys()).filter(key => key.startsWith(tutorialKey));
            keysToRemove.forEach(key => incorrectAnswers.delete(key));
            saveQuizState();
            // Re-render the quiz from the beginning (not in review mode)
            renderQuiz(tutorialKey, false);
        });
    });
    
    // Add event listener for the new "Back to Home" button
    const backToHomeButton = document.getElementById('back-to-home-button');
    if (backToHomeButton) {
        backToHomeButton.addEventListener('click', () => {
            window.location.href = '../index.html';
        });
    }
}

// Highlights the active navigation item in the sidebar.
function setActiveNavItem(sectionKey) {
    document.querySelectorAll('.sidebar-nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.section === sectionKey);
    });
}

// Shows the relevant section and hides others.
function showSection(sectionId) {
    document.querySelectorAll('.question-section').forEach(section => section.classList.add('hidden'));
    const sectionToShow = document.getElementById(sectionId);
    if (sectionToShow) {
        sectionToShow.classList.remove('hidden');
    }
    // Add the smooth scrolling behavior to fix the page position
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// --- INITIALIZATION ---

window.addEventListener('load', () => {
    // We no longer need to calculate header height for scrolling
    // if (header) {
    //      headerHeight = header.offsetHeight;
    // }

    loadQuizState();
    buildDynamicUI(); // Build UI first based on data.js

    // Render the last viewed tutorial or the first one by default.
    const firstTutorialKey = Object.keys(quizData).filter(key => key !== 'courseTitle')[0];
    const initialTutorial = quizData[currentQuiz.tutorial] ? currentQuiz.tutorial : firstTutorialKey;

    // Show the initial tutorial section without any scrolling.
    setActiveNavItem(initialTutorial);
    currentQuiz.tutorial = initialTutorial;
    const tutorialTitle = quizData[initialTutorial]?.title || initialTutorial.replace(/-/g, ' ').toUpperCase();
    currentTutorialTitle.textContent = tutorialTitle;
    renderQuiz(initialTutorial, false);

    hamburgerMenu.addEventListener('click', () => {
        sidebar.classList.toggle('active');
        sidebarBackdrop.classList.toggle('active');
    });

    sidebarBackdrop.addEventListener('click', () => {
        sidebar.classList.remove('active');
        sidebarBackdrop.classList.remove('active');
    });

    // **التعديل: تفعيل كود زر الارتفاع للأعلى**
    const scrollToTopButton = document.getElementById('scroll-to-top-button');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 300) { // يظهر الزر بعد 300 بكسل من التمرير
            scrollToTopButton.style.display = 'flex';
        } else {
            scrollToTopButton.style.display = 'none';
        }
    });
    scrollToTopButton.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // Removed the dark mode toggle functionality
    // const darkModeToggle = document.getElementById('dark-mode-toggle');
    // darkModeToggle.addEventListener('change', () => {
    //      document.body.classList.toggle('dark-mode', darkModeToggle.checked);
    //      localStorage.setItem('darkMode', darkModeToggle.checked);
    // });
    
    // const isDarkMode = localStorage.getItem('darkMode') === 'true';
    // darkModeToggle.checked = isDarkMode;
    // if (isDarkMode) {
    //      document.body.classList.add('dark-mode');
    // }

    const fontSizeIncreaseBtn = document.getElementById('font-size-increase');
    const fontSizeDecreaseBtn = document.getElementById('font-size-decrease');
    const htmlElement = document.documentElement;
    fontSizeIncreaseBtn.addEventListener('click', () => {
        let currentSize = parseFloat(getComputedStyle(htmlElement).fontSize);
        htmlElement.style.fontSize = (currentSize + 1) + 'px';
    });
    fontSizeDecreaseBtn.addEventListener('click', () => {
        let currentSize = parseFloat(getComputedStyle(htmlElement).fontSize);
        if (currentSize > 8) {
            htmlElement.style.fontSize = (currentSize - 1) + 'px';
        }
    });
});
