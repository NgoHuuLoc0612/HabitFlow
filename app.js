// ===================================
// Application State Management
// ===================================
class HabitTrackerApp {
    constructor() {
        this.habits = [];
        this.completions = {};
        this.settings = {
            theme: 'light',
            notifications: true,
            reminderTime: '09:00'
        };
        this.notifications = [];
        this.currentView = 'dashboard';
        this.currentFilter = 'all';
        this.currentMonth = moment();
        this.editingHabitId = null;
        this.dateRangeDays = 30;
        this.customDateStart = null;
        this.customDateEnd = null;
        
        this.init();
    }

    init() {
        this.loadData();
        this.initializeUI();
        this.attachEventListeners();
        this.renderDashboard();
        this.updateDate();
        this.applyTheme();
        this.checkDailyReset();
        this.initializeCharts();
        
        // Auto-save every 30 seconds
        setInterval(() => this.saveData(), 30000);
    }

    // ===================================
    // Data Management
    // ===================================
    loadData() {
        try {
            const savedHabits = localStorage.getItem('habits');
            const savedCompletions = localStorage.getItem('completions');
            const savedSettings = localStorage.getItem('settings');
            const savedNotifications = localStorage.getItem('notifications');
            
            if (savedHabits) this.habits = JSON.parse(savedHabits);
            if (savedCompletions) this.completions = JSON.parse(savedCompletions);
            if (savedSettings) this.settings = JSON.parse(savedSettings);
            if (savedNotifications) this.notifications = JSON.parse(savedNotifications);
        } catch (error) {
            console.error('Error loading data:', error);
            this.showToast('Error loading data', 'error');
        }
    }

    saveData() {
        try {
            localStorage.setItem('habits', JSON.stringify(this.habits));
            localStorage.setItem('completions', JSON.stringify(this.completions));
            localStorage.setItem('settings', JSON.stringify(this.settings));
            localStorage.setItem('notifications', JSON.stringify(this.notifications));
        } catch (error) {
            console.error('Error saving data:', error);
            this.showToast('Error saving data', 'error');
        }
    }

    exportData() {
        const data = {
            habits: this.habits,
            completions: this.completions,
            settings: this.settings,
            exportDate: moment().format('YYYY-MM-DD HH:mm:ss')
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `habit-tracker-backup-${moment().format('YYYY-MM-DD')}.json`;
        a.click();
        URL.revokeObjectURL(url);
        
        this.showToast('Data exported successfully', 'success');
    }

    importData(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                if (data.habits && data.completions) {
                    this.habits = data.habits;
                    this.completions = data.completions;
                    if (data.settings) this.settings = data.settings;
                    
                    this.saveData();
                    this.renderDashboard();
                    this.showToast('Data imported successfully', 'success');
                    location.reload();
                } else {
                    throw new Error('Invalid data format');
                }
            } catch (error) {
                console.error('Error importing data:', error);
                this.showToast('Error importing data', 'error');
            }
        };
        reader.readAsText(file);
    }

    resetData() {
        if (confirm('Are you sure you want to reset all data? This action cannot be undone.')) {
            localStorage.clear();
            location.reload();
        }
    }

    checkDailyReset() {
        const lastVisit = localStorage.getItem('lastVisit');
        const today = moment().format('YYYY-MM-DD');
        
        if (lastVisit !== today) {
            localStorage.setItem('lastVisit', today);
            this.addNotification('Daily Reset', 'New day started! Time to build your habits.');
        }
    }

    // ===================================
    // Habit Management
    // ===================================
    addHabit(habitData) {
        const habit = {
            id: Date.now().toString(),
            name: habitData.name,
            description: habitData.description || '',
            category: habitData.category,
            icon: habitData.icon,
            color: habitData.color,
            target: parseInt(habitData.target) || 1,
            frequency: habitData.frequency,
            selectedDays: habitData.selectedDays || [0, 1, 2, 3, 4, 5, 6],
            reminderTime: habitData.reminderTime || null,
            createdAt: moment().format('YYYY-MM-DD'),
            streak: 0,
            bestStreak: 0,
            totalCompletions: 0
        };
        
        this.habits.push(habit);
        this.saveData();
        this.showToast('Habit added successfully', 'success');
        this.addNotification('New Habit', `"${habit.name}" has been added to your tracker.`);
    }

    updateHabit(id, habitData) {
        const index = this.habits.findIndex(h => h.id === id);
        if (index !== -1) {
            this.habits[index] = {
                ...this.habits[index],
                name: habitData.name,
                description: habitData.description || '',
                category: habitData.category,
                icon: habitData.icon,
                color: habitData.color,
                target: parseInt(habitData.target) || 1,
                frequency: habitData.frequency,
                selectedDays: habitData.selectedDays || [0, 1, 2, 3, 4, 5, 6],
                reminderTime: habitData.reminderTime || null
            };
            
            this.saveData();
            this.showToast('Habit updated successfully', 'success');
        }
    }

    deleteHabit(id) {
        if (confirm('Are you sure you want to delete this habit?')) {
            this.habits = this.habits.filter(h => h.id !== id);
            
            // Clean up completions
            Object.keys(this.completions).forEach(date => {
                if (this.completions[date][id]) {
                    delete this.completions[date][id];
                }
            });
            
            this.saveData();
            this.renderDashboard();
            this.showToast('Habit deleted successfully', 'success');
        }
    }

    toggleHabitCompletion(habitId) {
        const today = moment().format('YYYY-MM-DD');
        
        if (!this.completions[today]) {
            this.completions[today] = {};
        }
        
        const habit = this.habits.find(h => h.id === habitId);
        if (!habit) return;
        
        if (this.completions[today][habitId]) {
            delete this.completions[today][habitId];
            habit.totalCompletions = Math.max(0, habit.totalCompletions - 1);
            this.showToast('Habit unmarked', 'info');
        } else {
            this.completions[today][habitId] = {
                completed: true,
                timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
            };
            habit.totalCompletions++;
            this.updateStreak(habitId);
            this.showToast('Great job! Keep it up! 🎉', 'success');
            this.addNotification('Habit Completed', `You completed "${habit.name}"!`);
        }
        
        this.saveData();
        this.renderDashboard();
        this.updateStats();
    }

    updateStreak(habitId) {
        const habit = this.habits.find(h => h.id === habitId);
        if (!habit) return;
        
        let streak = 0;
        let currentDate = moment();
        
        while (true) {
            const dateStr = currentDate.format('YYYY-MM-DD');
            if (this.completions[dateStr] && this.completions[dateStr][habitId]) {
                streak++;
                currentDate = currentDate.subtract(1, 'day');
            } else {
                break;
            }
        }
        
        habit.streak = streak;
        habit.bestStreak = Math.max(habit.bestStreak, streak);
    }

    isHabitActiveToday(habit) {
        if (habit.frequency === 'daily') return true;
        
        const today = moment().day();
        return habit.selectedDays.includes(today);
    }

    // ===================================
    // UI Initialization
    // ===================================
    initializeUI() {
        this.elements = {
            // Views
            views: document.querySelectorAll('.view'),
            navBtns: document.querySelectorAll('.nav-btn'),
            
            // Dashboard
            currentDate: document.getElementById('currentDate'),
            currentStreak: document.getElementById('currentStreak'),
            totalCompleted: document.getElementById('totalCompleted'),
            completionRate: document.getElementById('completionRate'),
            totalPoints: document.getElementById('totalPoints'),
            todaysHabits: document.getElementById('todaysHabits'),
            filterBtns: document.querySelectorAll('.filter-btn'),
            
            // Modal
            habitModal: document.getElementById('habitModal'),
            habitForm: document.getElementById('habitForm'),
            closeModal: document.getElementById('closeModal'),
            cancelBtn: document.getElementById('cancelBtn'),
            modalTitle: document.getElementById('modalTitle'),
            
            // Form inputs
            habitName: document.getElementById('habitName'),
            habitDescription: document.getElementById('habitDescription'),
            habitCategory: document.getElementById('habitCategory'),
            habitIcon: document.getElementById('habitIcon'),
            habitColor: document.getElementById('habitColor'),
            habitTarget: document.getElementById('habitTarget'),
            habitReminder: document.getElementById('habitReminder'),
            frequencyBtns: document.querySelectorAll('.freq-btn'),
            daysSelection: document.getElementById('daysSelection'),
            dayBtns: document.querySelectorAll('.day-btn'),
            
            // Habits view
            habitSearch: document.getElementById('habitSearch'),
            habitCategories: document.getElementById('habitCategories'),
            
            // Calendar
            calendarMonth: document.getElementById('calendarMonth'),
            calendarGrid: document.getElementById('calendarGrid'),
            prevMonth: document.getElementById('prevMonth'),
            nextMonth: document.getElementById('nextMonth'),
            
            // Analytics
            dateRangeSelect: document.getElementById('dateRangeSelect'),
            customDateRange: document.getElementById('customDateRange'),
            
            // Settings
            themeToggle: document.getElementById('themeToggle'),
            themeSelect: document.getElementById('themeSelect'),
            reminderTime: document.getElementById('reminderTime'),
            enableNotifications: document.getElementById('enableNotifications'),
            exportDataBtn: document.getElementById('exportDataBtn'),
            importDataBtn: document.getElementById('importDataBtn'),
            importFileInput: document.getElementById('importFileInput'),
            resetDataBtn: document.getElementById('resetDataBtn'),
            
            // Notifications
            notificationBtn: document.getElementById('notificationBtn'),
            notificationBadge: document.getElementById('notificationBadge'),
            notificationPanel: document.getElementById('notificationPanel'),
            notificationList: document.getElementById('notificationList'),
            clearNotifications: document.getElementById('clearNotifications'),
            
            // Buttons
            addHabitBtn: document.getElementById('addHabitBtn'),
            addHabitBtn2: document.getElementById('addHabitBtn2')
        };
        
        // Initialize Sortable for drag and drop
        if (this.elements.todaysHabits) {
            new Sortable(this.elements.todaysHabits, {
                animation: 150,
                handle: '.habit-icon',
                onEnd: () => this.saveHabitOrder()
            });
        }
        
        // Initialize Flatpickr for custom date range
        if (this.elements.customDateRange) {
            flatpickr(this.elements.customDateRange, {
                mode: 'range',
                dateFormat: 'Y-m-d',
                onChange: (selectedDates) => {
                    if (selectedDates.length === 2) {
                        this.customDateStart = moment(selectedDates[0]);
                        this.customDateEnd = moment(selectedDates[1]);
                        this.renderAnalytics();
                    }
                }
            });
        }
    }

    // ===================================
    // Event Listeners
    // ===================================
    attachEventListeners() {
        // Navigation
        this.elements.navBtns.forEach(btn => {
            btn.addEventListener('click', (e) => this.switchView(e.target.closest('.nav-btn').dataset.view));
        });
        
        // Filter buttons
        this.elements.filterBtns.forEach(btn => {
            btn.addEventListener('click', (e) => this.filterHabits(e.target.dataset.filter));
        });
        
        // Add habit buttons
        this.elements.addHabitBtn.addEventListener('click', () => this.openHabitModal());
        this.elements.addHabitBtn2.addEventListener('click', () => this.openHabitModal());
        
        // Modal
        this.elements.closeModal.addEventListener('click', () => this.closeHabitModal());
        this.elements.cancelBtn.addEventListener('click', () => this.closeHabitModal());
        this.elements.habitForm.addEventListener('submit', (e) => this.handleHabitSubmit(e));
        
        // Frequency buttons
        this.elements.frequencyBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                this.elements.frequencyBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.elements.daysSelection.style.display = 
                    btn.dataset.freq === 'custom' ? 'block' : 'none';
            });
        });
        
        // Day buttons
        this.elements.dayBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                btn.classList.toggle('active');
            });
        });
        
        // Theme toggle
        this.elements.themeToggle.addEventListener('click', () => this.toggleTheme());
        this.elements.themeSelect.addEventListener('change', (e) => {
            this.settings.theme = e.target.value;
            this.applyTheme();
            this.saveData();
        });
        
        // Calendar navigation
        this.elements.prevMonth.addEventListener('click', () => {
            this.currentMonth = this.currentMonth.subtract(1, 'month');
            this.renderCalendar();
        });
        
        this.elements.nextMonth.addEventListener('click', () => {
            this.currentMonth = this.currentMonth.add(1, 'month');
            this.renderCalendar();
        });
        
        // Notifications
        this.elements.notificationBtn.addEventListener('click', () => {
            this.elements.notificationPanel.classList.toggle('active');
        });
        
        this.elements.clearNotifications.addEventListener('click', () => {
            this.notifications = [];
            this.saveData();
            this.renderNotifications();
        });
        
        // Settings
        this.elements.reminderTime.addEventListener('change', (e) => {
            this.settings.reminderTime = e.target.value;
            this.saveData();
        });
        
        this.elements.enableNotifications.addEventListener('change', (e) => {
            this.settings.notifications = e.target.checked;
            this.saveData();
        });
        
        this.elements.exportDataBtn.addEventListener('click', () => this.exportData());
        this.elements.importDataBtn.addEventListener('click', () => this.elements.importFileInput.click());
        this.elements.importFileInput.addEventListener('change', (e) => {
            if (e.target.files[0]) {
                this.importData(e.target.files[0]);
            }
        });
        this.elements.resetDataBtn.addEventListener('click', () => this.resetData());
        
        // Search
        if (this.elements.habitSearch) {
            this.elements.habitSearch.addEventListener('input', _.debounce((e) => {
                this.searchHabits(e.target.value);
            }, 300));
        }
        
        // Date range selector
        if (this.elements.dateRangeSelect) {
            this.elements.dateRangeSelect.addEventListener('change', (e) => {
                const value = e.target.value;
                if (value === 'custom') {
                    this.elements.customDateRange.style.display = 'block';
                } else {
                    this.elements.customDateRange.style.display = 'none';
                    this.dateRangeDays = parseInt(value);
                    this.renderAnalytics();
                }
            });
        }
        
        // Close modal on outside click
        this.elements.habitModal.addEventListener('click', (e) => {
            if (e.target === this.elements.habitModal) {
                this.closeHabitModal();
            }
        });
    }

    // ===================================
    // View Management
    // ===================================
    switchView(viewName) {
        this.currentView = viewName;
        
        // Update navigation
        this.elements.navBtns.forEach(btn => btn.classList.remove('active'));
        document.querySelector(`[data-view="${viewName}"]`).classList.add('active');
        
        // Update views
        this.elements.views.forEach(view => view.classList.remove('active'));
        document.getElementById(`${viewName}View`).classList.add('active');
        
        // Render appropriate content
        switch(viewName) {
            case 'dashboard':
                this.renderDashboard();
                break;
            case 'habits':
                this.renderHabitsView();
                break;
            case 'analytics':
                this.renderAnalytics();
                break;
            case 'calendar':
                this.renderCalendar();
                break;
            case 'settings':
                this.renderSettings();
                break;
        }
    }

    // ===================================
    // Dashboard Rendering
    // ===================================
    renderDashboard() {
        this.updateStats();
        this.renderTodaysHabits();
        this.renderWeeklyChart();
    }

    updateStats() {
        const today = moment().format('YYYY-MM-DD');
        const todaysHabits = this.habits.filter(h => this.isHabitActiveToday(h));
        const completed = todaysHabits.filter(h => 
            this.completions[today] && this.completions[today][h.id]
        ).length;
        
        // Current streak (longest current streak)
        const streaks = this.habits.map(h => h.streak);
        const maxStreak = streaks.length > 0 ? Math.max(...streaks) : 0;
        
        // Completion rate
        const rate = todaysHabits.length > 0 ? 
            Math.round((completed / todaysHabits.length) * 100) : 0;
        
        // Total points (completions * 10)
        const totalPoints = this.habits.reduce((sum, h) => sum + h.totalCompletions, 0) * 10;
        
        this.elements.currentStreak.textContent = maxStreak;
        this.elements.totalCompleted.textContent = `${completed}/${todaysHabits.length}`;
        this.elements.completionRate.textContent = `${rate}%`;
        this.elements.totalPoints.textContent = totalPoints;
    }

    renderTodaysHabits() {
        const today = moment().format('YYYY-MM-DD');
        let habits = this.habits.filter(h => this.isHabitActiveToday(h));
        
        // Apply filter
        if (this.currentFilter === 'completed') {
            habits = habits.filter(h => this.completions[today] && this.completions[today][h.id]);
        } else if (this.currentFilter === 'pending') {
            habits = habits.filter(h => !this.completions[today] || !this.completions[today][h.id]);
        }
        
        if (habits.length === 0) {
            this.elements.todaysHabits.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-calendar-check"></i>
                    <h3>No habits for today</h3>
                    <p>Add your first habit to get started!</p>
                </div>
            `;
            return;
        }
        
        this.elements.todaysHabits.innerHTML = habits.map(habit => {
            const isCompleted = this.completions[today] && this.completions[today][habit.id];
            
            return `
                <div class="habit-item ${isCompleted ? 'completed' : ''}" data-id="${habit.id}">
                    <div class="habit-checkbox ${isCompleted ? 'checked' : ''}" 
                         onclick="app.toggleHabitCompletion('${habit.id}')">
                        ${isCompleted ? '<i class="fas fa-check"></i>' : ''}
                    </div>
                    <div class="habit-icon" style="background: ${habit.color};">
                        <i class="fas ${habit.icon}"></i>
                    </div>
                    <div class="habit-details">
                        <h4>${habit.name}</h4>
                        <p>${habit.description || habit.category}</p>
                    </div>
                    <div class="habit-meta">
                        <div class="habit-streak">
                            <i class="fas fa-fire"></i>
                            <span>${habit.streak}</span>
                        </div>
                        <div class="habit-actions">
                            <button class="habit-action-btn edit" onclick="app.editHabit('${habit.id}')">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="habit-action-btn delete" onclick="app.deleteHabit('${habit.id}')">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    filterHabits(filter) {
        this.currentFilter = filter;
        this.elements.filterBtns.forEach(btn => btn.classList.remove('active'));
        document.querySelector(`[data-filter="${filter}"]`).classList.add('active');
        this.renderTodaysHabits();
    }

    // ===================================
    // Habits View
    // ===================================
    renderHabitsView() {
        const categories = _.groupBy(this.habits, 'category');
        const categoryIcons = {
            health: 'fa-heartbeat',
            productivity: 'fa-briefcase',
            mindfulness: 'fa-spa',
            learning: 'fa-graduation-cap',
            social: 'fa-users',
            finance: 'fa-dollar-sign',
            hobby: 'fa-palette',
            other: 'fa-star'
        };
        
        this.elements.habitCategories.innerHTML = Object.keys(categories).map(category => {
            const habits = categories[category];
            const icon = categoryIcons[category] || 'fa-star';
            
            return `
                <div class="category-card">
                    <div class="category-header">
                        <div class="category-title">
                            <i class="fas ${icon}"></i>
                            <h3>${category.charAt(0).toUpperCase() + category.slice(1)}</h3>
                        </div>
                        <span class="category-count">${habits.length}</span>
                    </div>
                    <div class="habits-list">
                        ${habits.map(habit => `
                            <div class="habit-item" data-id="${habit.id}">
                                <div class="habit-icon" style="background: ${habit.color};">
                                    <i class="fas ${habit.icon}"></i>
                                </div>
                                <div class="habit-details">
                                    <h4>${habit.name}</h4>
                                    <p>${habit.description || 'No description'}</p>
                                </div>
                                <div class="habit-meta">
                                    <div class="habit-streak">
                                        <i class="fas fa-fire"></i>
                                        <span>${habit.streak}</span>
                                    </div>
                                    <div class="habit-actions">
                                        <button class="habit-action-btn edit" onclick="app.editHabit('${habit.id}')">
                                            <i class="fas fa-edit"></i>
                                        </button>
                                        <button class="habit-action-btn delete" onclick="app.deleteHabit('${habit.id}')">
                                            <i class="fas fa-trash"></i>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }).join('');
    }

    searchHabits(query) {
        if (!query) {
            this.renderHabitsView();
            return;
        }
        
        const filtered = this.habits.filter(h => 
            h.name.toLowerCase().includes(query.toLowerCase()) ||
            h.description.toLowerCase().includes(query.toLowerCase()) ||
            h.category.toLowerCase().includes(query.toLowerCase())
        );
        
        // Render filtered results
        const categories = _.groupBy(filtered, 'category');
        // ... similar to renderHabitsView but with filtered data
    }

    // ===================================
    // Analytics
    // ===================================
    renderAnalytics() {
        this.renderCompletionTrendChart();
        this.renderHabitDistributionChart();
        this.renderBestHabits();
        this.renderStreakHistoryChart();
        this.renderCategoryRadarChart();
        this.renderFrequencyRadarChart();
        this.renderTimeOfDayRadarChart();
        this.renderWeeklyRadarChart();
        this.renderConsistencyRadarChart();
        this.renderTargetRadarChart();
        
        // New advanced charts
        this.renderCategoryPolarChart();
        this.renderTimeInvestmentPolarChart();
        this.renderStreakQualityPolarChart();
        this.renderHabitBubbleChart();
        this.renderCategoryBubbleChart();
        this.renderStreakCompletionScatter();
        this.renderTargetActualScatter();
        this.renderConsistencyFrequencyScatter();
        this.renderCorrelationHeatmap();
        this.renderMultiDimensionalBubble();
        this.renderMomentumPolarChart();
    }

    getDateRangeData() {
        const days = this.customDateStart && this.customDateEnd ?
            this.customDateEnd.diff(this.customDateStart, 'days') + 1 :
            this.dateRangeDays;
        
        const startDate = this.customDateStart || moment().subtract(days - 1, 'days');
        const data = [];
        
        for (let i = 0; i < days; i++) {
            const date = moment(startDate).add(i, 'days');
            data.push(date);
        }
        
        return data;
    }

    renderWeeklyChart() {
        const ctx = document.getElementById('weeklyProgressChart');
        if (!ctx) return;
        
        if (this.weeklyChart) {
            this.weeklyChart.destroy();
        }
        
        const last7Days = [];
        const completionData = [];
        
        for (let i = 6; i >= 0; i--) {
            const date = moment().subtract(i, 'days');
            const dateStr = date.format('YYYY-MM-DD');
            last7Days.push(date.format('ddd'));
            
            const dayHabits = this.habits.filter(h => {
                if (h.frequency === 'daily') return true;
                return h.selectedDays.includes(date.day());
            });
            
            const completed = this.completions[dateStr] ? 
                Object.keys(this.completions[dateStr]).length : 0;
            
            completionData.push(completed);
        }
        
        this.weeklyChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: last7Days,
                datasets: [{
                    label: 'Completed Habits',
                    data: completionData,
                    borderColor: 'rgb(102, 126, 234)',
                    backgroundColor: 'rgba(102, 126, 234, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1
                        }
                    }
                }
            }
        });
    }

    renderCompletionTrendChart() {
        const ctx = document.getElementById('completionTrendChart');
        if (!ctx) return;
        
        if (this.completionChart) {
            this.completionChart.destroy();
        }
        
        const last30Days = [];
        const completionRates = [];
        
        for (let i = 29; i >= 0; i--) {
            const date = moment().subtract(i, 'days');
            const dateStr = date.format('YYYY-MM-DD');
            last30Days.push(date.format('MM/DD'));
            
            const dayHabits = this.habits.filter(h => {
                if (h.frequency === 'daily') return true;
                return h.selectedDays.includes(date.day());
            }).length;
            
            const completed = this.completions[dateStr] ? 
                Object.keys(this.completions[dateStr]).length : 0;
            
            const rate = dayHabits > 0 ? (completed / dayHabits) * 100 : 0;
            completionRates.push(rate);
        }
        
        this.completionChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: last30Days,
                datasets: [{
                    label: 'Completion Rate (%)',
                    data: completionRates,
                    backgroundColor: 'rgba(102, 126, 234, 0.8)',
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        ticks: {
                            callback: function(value) {
                                return value + '%';
                            }
                        }
                    }
                }
            }
        });
    }

    renderHabitDistributionChart() {
        const ctx = document.getElementById('habitDistributionChart');
        if (!ctx) return;
        
        if (this.distributionChart) {
            this.distributionChart.destroy();
        }
        
        const categories = _.groupBy(this.habits, 'category');
        const labels = Object.keys(categories);
        const data = labels.map(cat => categories[cat].length);
        
        const colors = [
            '#667eea', '#f093fb', '#4facfe', '#43e97b',
            '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'
        ];
        
        this.distributionChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels.map(l => l.charAt(0).toUpperCase() + l.slice(1)),
                datasets: [{
                    data: data,
                    backgroundColor: colors,
                    borderWidth: 2,
                    borderColor: getComputedStyle(document.documentElement)
                        .getPropertyValue('--bg-primary')
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    }

    renderBestHabits() {
        const sorted = [...this.habits]
            .sort((a, b) => b.totalCompletions - a.totalCompletions)
            .slice(0, 5);
        
        const container = document.getElementById('bestHabits');
        if (!container) return;
        
        if (sorted.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-trophy"></i>
                    <h3>No data yet</h3>
                    <p>Complete habits to see your best performers</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = sorted.map((habit, index) => `
            <div class="best-habit-item">
                <div class="best-habit-rank">${index + 1}</div>
                <div class="best-habit-icon" style="background: ${habit.color};">
                    <i class="fas ${habit.icon}"></i>
                </div>
                <div class="best-habit-details">
                    <h4>${habit.name}</h4>
                    <p>${habit.totalCompletions} completions</p>
                </div>
            </div>
        `).join('');
    }

    renderStreakHistoryChart() {
        const ctx = document.getElementById('streakHistoryChart');
        if (!ctx) return;
        
        if (this.streakChart) {
            this.streakChart.destroy();
        }
        
        const topHabits = [...this.habits]
            .sort((a, b) => b.bestStreak - a.bestStreak)
            .slice(0, 5);
        
        this.streakChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: topHabits.map(h => h.name),
                datasets: [
                    {
                        label: 'Current Streak',
                        data: topHabits.map(h => h.streak),
                        backgroundColor: 'rgba(102, 126, 234, 0.8)',
                        borderRadius: 4
                    },
                    {
                        label: 'Best Streak',
                        data: topHabits.map(h => h.bestStreak),
                        backgroundColor: 'rgba(67, 233, 123, 0.8)',
                        borderRadius: 4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y',
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1
                        }
                    }
                }
            }
        });
    }

    initializeCharts() {
        // Initialize empty charts on load
        setTimeout(() => {
            if (document.getElementById('weeklyProgressChart')) {
                this.renderWeeklyChart();
            }
        }, 100);
    }

    // ===================================
    // Advanced Radar Charts
    // ===================================
    renderCategoryRadarChart() {
        const ctx = document.getElementById('categoryRadarChart');
        if (!ctx) return;
        
        if (this.categoryRadarChart) {
            this.categoryRadarChart.destroy();
        }
        
        // Group habits by category and calculate performance metrics
        const categories = _.groupBy(this.habits, 'category');
        const categoryData = {};
        
        Object.keys(categories).forEach(category => {
            const habits = categories[category];
            const totalCompletions = habits.reduce((sum, h) => sum + h.totalCompletions, 0);
            const avgStreak = habits.reduce((sum, h) => sum + h.streak, 0) / habits.length;
            const avgCompletion = habits.reduce((sum, h) => {
                const last30 = this.getLast30DaysCompletions(h.id);
                return sum + last30;
            }, 0) / habits.length;
            
            categoryData[category] = {
                completions: totalCompletions,
                avgStreak: avgStreak,
                avgCompletion: avgCompletion,
                count: habits.length
            };
        });
        
        const labels = Object.keys(categoryData).map(cat => 
            cat.charAt(0).toUpperCase() + cat.slice(1)
        );
        
        const completionData = Object.values(categoryData).map(d => d.avgCompletion);
        const streakData = Object.values(categoryData).map(d => d.avgStreak);
        const countData = Object.values(categoryData).map(d => d.count * 5); // Scale for visibility
        
        this.categoryRadarChart = new Chart(ctx, {
            type: 'radar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Avg Completions (30d)',
                        data: completionData,
                        backgroundColor: 'rgba(102, 126, 234, 0.2)',
                        borderColor: 'rgb(102, 126, 234)',
                        borderWidth: 2,
                        pointBackgroundColor: 'rgb(102, 126, 234)',
                        pointBorderColor: '#fff',
                        pointHoverBackgroundColor: '#fff',
                        pointHoverBorderColor: 'rgb(102, 126, 234)'
                    },
                    {
                        label: 'Avg Streak',
                        data: streakData,
                        backgroundColor: 'rgba(240, 147, 251, 0.2)',
                        borderColor: 'rgb(240, 147, 251)',
                        borderWidth: 2,
                        pointBackgroundColor: 'rgb(240, 147, 251)',
                        pointBorderColor: '#fff',
                        pointHoverBackgroundColor: '#fff',
                        pointHoverBorderColor: 'rgb(240, 147, 251)'
                    },
                    {
                        label: 'Habit Count (×5)',
                        data: countData,
                        backgroundColor: 'rgba(67, 233, 123, 0.2)',
                        borderColor: 'rgb(67, 233, 123)',
                        borderWidth: 2,
                        pointBackgroundColor: 'rgb(67, 233, 123)',
                        pointBorderColor: '#fff',
                        pointHoverBackgroundColor: '#fff',
                        pointHoverBorderColor: 'rgb(67, 233, 123)'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    r: {
                        beginAtZero: true,
                        ticks: {
                            backdropColor: 'transparent'
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)'
                        },
                        angleLines: {
                            color: 'rgba(0, 0, 0, 0.1)'
                        }
                    }
                },
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    }

    renderFrequencyRadarChart() {
        const ctx = document.getElementById('frequencyRadarChart');
        if (!ctx) return;
        
        if (this.frequencyRadarChart) {
            this.frequencyRadarChart.destroy();
        }
        
        // Analyze habits by frequency type
        const frequencies = {
            'Daily': this.habits.filter(h => h.frequency === 'daily'),
            'Weekly': this.habits.filter(h => h.frequency === 'weekly'),
            'Custom': this.habits.filter(h => h.frequency === 'custom')
        };
        
        const labels = Object.keys(frequencies);
        const countData = Object.values(frequencies).map(habits => habits.length);
        const completionData = Object.values(frequencies).map(habits => {
            if (habits.length === 0) return 0;
            return habits.reduce((sum, h) => sum + h.totalCompletions, 0) / habits.length;
        });
        const streakData = Object.values(frequencies).map(habits => {
            if (habits.length === 0) return 0;
            return habits.reduce((sum, h) => sum + h.streak, 0) / habits.length;
        });
        
        this.frequencyRadarChart = new Chart(ctx, {
            type: 'radar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Habit Count',
                        data: countData,
                        backgroundColor: 'rgba(79, 172, 254, 0.2)',
                        borderColor: 'rgb(79, 172, 254)',
                        borderWidth: 2,
                        pointBackgroundColor: 'rgb(79, 172, 254)',
                        pointBorderColor: '#fff'
                    },
                    {
                        label: 'Avg Completions',
                        data: completionData,
                        backgroundColor: 'rgba(245, 158, 11, 0.2)',
                        borderColor: 'rgb(245, 158, 11)',
                        borderWidth: 2,
                        pointBackgroundColor: 'rgb(245, 158, 11)',
                        pointBorderColor: '#fff'
                    },
                    {
                        label: 'Avg Streak',
                        data: streakData,
                        backgroundColor: 'rgba(239, 68, 68, 0.2)',
                        borderColor: 'rgb(239, 68, 68)',
                        borderWidth: 2,
                        pointBackgroundColor: 'rgb(239, 68, 68)',
                        pointBorderColor: '#fff'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    r: {
                        beginAtZero: true,
                        ticks: {
                            backdropColor: 'transparent'
                        }
                    }
                },
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    }

    renderTimeOfDayRadarChart() {
        const ctx = document.getElementById('timeOfDayRadarChart');
        if (!ctx) return;
        
        if (this.timeOfDayRadarChart) {
            this.timeOfDayRadarChart.destroy();
        }
        
        // Analyze completion times (if reminder times are set)
        const timeSlots = {
            'Early Morning (5-8)': 0,
            'Morning (8-12)': 0,
            'Afternoon (12-17)': 0,
            'Evening (17-21)': 0,
            'Night (21-24)': 0,
            'Late Night (0-5)': 0
        };
        
        // Count completions by time based on completion timestamps
        Object.values(this.completions).forEach(day => {
            Object.values(day).forEach(completion => {
                if (completion.timestamp) {
                    const hour = parseInt(moment(completion.timestamp).format('H'));
                    if (hour >= 5 && hour < 8) timeSlots['Early Morning (5-8)']++;
                    else if (hour >= 8 && hour < 12) timeSlots['Morning (8-12)']++;
                    else if (hour >= 12 && hour < 17) timeSlots['Afternoon (12-17)']++;
                    else if (hour >= 17 && hour < 21) timeSlots['Evening (17-21)']++;
                    else if (hour >= 21 && hour < 24) timeSlots['Night (21-24)']++;
                    else timeSlots['Late Night (0-5)']++;
                }
            });
        });
        
        const labels = Object.keys(timeSlots);
        const data = Object.values(timeSlots);
        
        this.timeOfDayRadarChart = new Chart(ctx, {
            type: 'radar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Completions by Time',
                    data: data,
                    backgroundColor: 'rgba(139, 92, 246, 0.2)',
                    borderColor: 'rgb(139, 92, 246)',
                    borderWidth: 2,
                    pointBackgroundColor: 'rgb(139, 92, 246)',
                    pointBorderColor: '#fff',
                    pointHoverBackgroundColor: '#fff',
                    pointHoverBorderColor: 'rgb(139, 92, 246)'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    r: {
                        beginAtZero: true,
                        ticks: {
                            backdropColor: 'transparent'
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    }
                }
            }
        });
    }

    renderWeeklyRadarChart() {
        const ctx = document.getElementById('weeklyRadarChart');
        if (!ctx) return;
        
        if (this.weeklyRadarChart) {
            this.weeklyRadarChart.destroy();
        }
        
        // Calculate completions by day of week
        const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const completionsByDay = [0, 0, 0, 0, 0, 0, 0];
        const habitsByDay = [0, 0, 0, 0, 0, 0, 0];
        
        Object.keys(this.completions).forEach(dateStr => {
            const dayIndex = moment(dateStr).day();
            completionsByDay[dayIndex] += Object.keys(this.completions[dateStr]).length;
        });
        
        // Count expected habits by day
        this.habits.forEach(habit => {
            if (habit.frequency === 'daily') {
                for (let i = 0; i < 7; i++) {
                    habitsByDay[i]++;
                }
            } else if (habit.selectedDays) {
                habit.selectedDays.forEach(day => {
                    habitsByDay[day]++;
                });
            }
        });
        
        // Calculate completion rates
        const completionRates = completionsByDay.map((count, i) => {
            return habitsByDay[i] > 0 ? (count / habitsByDay[i]) * 100 : 0;
        });
        
        this.weeklyRadarChart = new Chart(ctx, {
            type: 'radar',
            data: {
                labels: daysOfWeek,
                datasets: [
                    {
                        label: 'Completion Rate (%)',
                        data: completionRates,
                        backgroundColor: 'rgba(6, 182, 212, 0.2)',
                        borderColor: 'rgb(6, 182, 212)',
                        borderWidth: 2,
                        pointBackgroundColor: 'rgb(6, 182, 212)',
                        pointBorderColor: '#fff',
                        pointHoverBackgroundColor: '#fff',
                        pointHoverBorderColor: 'rgb(6, 182, 212)'
                    },
                    {
                        label: 'Total Completions',
                        data: completionsByDay,
                        backgroundColor: 'rgba(236, 72, 153, 0.2)',
                        borderColor: 'rgb(236, 72, 153)',
                        borderWidth: 2,
                        pointBackgroundColor: 'rgb(236, 72, 153)',
                        pointBorderColor: '#fff',
                        pointHoverBackgroundColor: '#fff',
                        pointHoverBorderColor: 'rgb(236, 72, 153)'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    r: {
                        beginAtZero: true,
                        ticks: {
                            backdropColor: 'transparent'
                        }
                    }
                },
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    }

    renderConsistencyRadarChart() {
        const ctx = document.getElementById('consistencyRadarChart');
        if (!ctx) return;
        
        if (this.consistencyRadarChart) {
            this.consistencyRadarChart.destroy();
        }
        
        // Get top 6 habits by completion
        const topHabits = [...this.habits]
            .sort((a, b) => b.totalCompletions - a.totalCompletions)
            .slice(0, 6);
        
        if (topHabits.length === 0) {
            return;
        }
        
        const labels = topHabits.map(h => h.name);
        const streakData = topHabits.map(h => h.streak);
        const completionData = topHabits.map(h => {
            const last30 = this.getLast30DaysCompletions(h.id);
            return last30;
        });
        const consistencyScore = topHabits.map(h => {
            const last30 = this.getLast30DaysCompletions(h.id);
            const possible = this.getLast30DaysPossible(h);
            return possible > 0 ? (last30 / possible) * 100 : 0;
        });
        
        this.consistencyRadarChart = new Chart(ctx, {
            type: 'radar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Current Streak',
                        data: streakData,
                        backgroundColor: 'rgba(251, 146, 60, 0.2)',
                        borderColor: 'rgb(251, 146, 60)',
                        borderWidth: 2,
                        pointBackgroundColor: 'rgb(251, 146, 60)',
                        pointBorderColor: '#fff'
                    },
                    {
                        label: 'Completions (30d)',
                        data: completionData,
                        backgroundColor: 'rgba(34, 197, 94, 0.2)',
                        borderColor: 'rgb(34, 197, 94)',
                        borderWidth: 2,
                        pointBackgroundColor: 'rgb(34, 197, 94)',
                        pointBorderColor: '#fff'
                    },
                    {
                        label: 'Consistency Score',
                        data: consistencyScore,
                        backgroundColor: 'rgba(168, 85, 247, 0.2)',
                        borderColor: 'rgb(168, 85, 247)',
                        borderWidth: 2,
                        pointBackgroundColor: 'rgb(168, 85, 247)',
                        pointBorderColor: '#fff'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    r: {
                        beginAtZero: true,
                        ticks: {
                            backdropColor: 'transparent'
                        }
                    }
                },
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    }

    renderTargetRadarChart() {
        const ctx = document.getElementById('targetRadarChart');
        if (!ctx) return;
        
        if (this.targetRadarChart) {
            this.targetRadarChart.destroy();
        }
        
        // Analyze target achievement by category
        const categories = _.groupBy(this.habits, 'category');
        const categoryMetrics = {};
        
        Object.keys(categories).forEach(category => {
            const habits = categories[category];
            let totalAchievement = 0;
            let targetCompletions = 0;
            let actualCompletions = 0;
            
            habits.forEach(habit => {
                const last30 = this.getLast30DaysCompletions(habit.id);
                const possible = this.getLast30DaysPossible(habit);
                actualCompletions += last30;
                targetCompletions += possible * habit.target;
            });
            
            totalAchievement = targetCompletions > 0 ? 
                (actualCompletions / targetCompletions) * 100 : 0;
            
            categoryMetrics[category] = {
                achievement: Math.min(totalAchievement, 100),
                actual: actualCompletions,
                target: targetCompletions
            };
        });
        
        const labels = Object.keys(categoryMetrics).map(cat => 
            cat.charAt(0).toUpperCase() + cat.slice(1)
        );
        const achievementData = Object.values(categoryMetrics).map(m => m.achievement);
        
        this.targetRadarChart = new Chart(ctx, {
            type: 'radar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Target Achievement (%)',
                    data: achievementData,
                    backgroundColor: 'rgba(20, 184, 166, 0.2)',
                    borderColor: 'rgb(20, 184, 166)',
                    borderWidth: 3,
                    pointBackgroundColor: 'rgb(20, 184, 166)',
                    pointBorderColor: '#fff',
                    pointHoverBackgroundColor: '#fff',
                    pointHoverBorderColor: 'rgb(20, 184, 166)',
                    pointRadius: 5,
                    pointHoverRadius: 7
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    r: {
                        beginAtZero: true,
                        max: 100,
                        ticks: {
                            backdropColor: 'transparent',
                            callback: function(value) {
                                return value + '%';
                            }
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return context.parsed.r.toFixed(1) + '%';
                            }
                        }
                    }
                }
            }
        });
    }

    // Helper methods for radar charts
    getLast30DaysCompletions(habitId) {
        let count = 0;
        for (let i = 0; i < 30; i++) {
            const date = moment().subtract(i, 'days').format('YYYY-MM-DD');
            if (this.completions[date] && this.completions[date][habitId]) {
                count++;
            }
        }
        return count;
    }

    getLast30DaysPossible(habit) {
        let count = 0;
        for (let i = 0; i < 30; i++) {
            const date = moment().subtract(i, 'days');
            const dayOfWeek = date.day();
            
            if (habit.frequency === 'daily') {
                count++;
            } else if (habit.selectedDays && habit.selectedDays.includes(dayOfWeek)) {
                count++;
            }
        }
        return count;
    }

    // ===================================
    // Polar Area Charts
    // ===================================
    renderCategoryPolarChart() {
        const ctx = document.getElementById('categoryPolarChart');
        if (!ctx) return;
        
        if (this.categoryPolarChart) {
            this.categoryPolarChart.destroy();
        }
        
        const categories = _.groupBy(this.habits, 'category');
        const labels = Object.keys(categories).map(cat => 
            cat.charAt(0).toUpperCase() + cat.slice(1)
        );
        
        const engagementData = Object.values(categories).map(habits => {
            const totalEngagement = habits.reduce((sum, h) => {
                const completions = this.getLast30DaysCompletions(h.id);
                const possible = this.getLast30DaysPossible(h);
                return sum + (possible > 0 ? (completions / possible) * 100 : 0);
            }, 0);
            return totalEngagement / habits.length;
        });
        
        const colors = [
            'rgba(102, 126, 234, 0.7)',
            'rgba(240, 147, 251, 0.7)',
            'rgba(79, 172, 254, 0.7)',
            'rgba(67, 233, 123, 0.7)',
            'rgba(245, 158, 11, 0.7)',
            'rgba(239, 68, 68, 0.7)',
            'rgba(139, 92, 246, 0.7)',
            'rgba(6, 182, 212, 0.7)'
        ];
        
        this.categoryPolarChart = new Chart(ctx, {
            type: 'polarArea',
            data: {
                labels: labels,
                datasets: [{
                    data: engagementData,
                    backgroundColor: colors.slice(0, labels.length),
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return context.label + ': ' + context.parsed.r.toFixed(1) + '% engagement';
                            }
                        }
                    }
                },
                scales: {
                    r: {
                        beginAtZero: true,
                        max: 100
                    }
                }
            }
        });
    }

    renderTimeInvestmentPolarChart() {
        const ctx = document.getElementById('timeInvestmentPolarChart');
        if (!ctx) return;
        
        if (this.timeInvestmentPolarChart) {
            this.timeInvestmentPolarChart.destroy();
        }
        
        const timeSlots = {
            'Morning': 0,
            'Afternoon': 0,
            'Evening': 0,
            'Night': 0
        };
        
        Object.values(this.completions).forEach(day => {
            Object.values(day).forEach(completion => {
                if (completion.timestamp) {
                    const hour = parseInt(moment(completion.timestamp).format('H'));
                    if (hour >= 5 && hour < 12) timeSlots['Morning']++;
                    else if (hour >= 12 && hour < 17) timeSlots['Afternoon']++;
                    else if (hour >= 17 && hour < 22) timeSlots['Evening']++;
                    else timeSlots['Night']++;
                }
            });
        });
        
        this.timeInvestmentPolarChart = new Chart(ctx, {
            type: 'polarArea',
            data: {
                labels: Object.keys(timeSlots),
                datasets: [{
                    data: Object.values(timeSlots),
                    backgroundColor: [
                        'rgba(251, 191, 36, 0.7)',
                        'rgba(59, 130, 246, 0.7)',
                        'rgba(168, 85, 247, 0.7)',
                        'rgba(30, 41, 59, 0.7)'
                    ],
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    }

    renderStreakQualityPolarChart() {
        const ctx = document.getElementById('streakQualityPolarChart');
        if (!ctx) return;
        
        if (this.streakQualityPolarChart) {
            this.streakQualityPolarChart.destroy();
        }
        
        const topHabits = [...this.habits]
            .sort((a, b) => b.streak - a.streak)
            .slice(0, 6);
        
        const labels = topHabits.map(h => h.name);
        const streakQuality = topHabits.map(h => {
            const currentStreak = h.streak;
            const bestStreak = h.bestStreak;
            return bestStreak > 0 ? (currentStreak / bestStreak) * 100 : 0;
        });
        
        this.streakQualityPolarChart = new Chart(ctx, {
            type: 'polarArea',
            data: {
                labels: labels,
                datasets: [{
                    data: streakQuality,
                    backgroundColor: [
                        'rgba(239, 68, 68, 0.7)',
                        'rgba(249, 115, 22, 0.7)',
                        'rgba(245, 158, 11, 0.7)',
                        'rgba(132, 204, 22, 0.7)',
                        'rgba(34, 197, 94, 0.7)',
                        'rgba(16, 185, 129, 0.7)'
                    ],
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return context.label + ': ' + context.parsed.r.toFixed(1) + '% of best';
                            }
                        }
                    }
                },
                scales: {
                    r: {
                        beginAtZero: true,
                        max: 100
                    }
                }
            }
        });
    }

    renderMomentumPolarChart() {
        const ctx = document.getElementById('momentumPolarChart');
        if (!ctx) return;
        
        if (this.momentumPolarChart) {
            this.momentumPolarChart.destroy();
        }
        
        const categories = _.groupBy(this.habits, 'category');
        const labels = Object.keys(categories).map(cat => 
            cat.charAt(0).toUpperCase() + cat.slice(1)
        );
        
        const momentumData = Object.values(categories).map(habits => {
            const avgMomentum = habits.reduce((sum, h) => {
                const last7 = this.getLastNDaysCompletions(h.id, 7);
                const prev7 = this.getLastNDaysCompletions(h.id, 14) - last7;
                const momentum = prev7 > 0 ? ((last7 - prev7) / prev7) * 100 + 100 : last7 * 20;
                return sum + momentum;
            }, 0);
            return Math.max(0, avgMomentum / habits.length);
        });
        
        this.momentumPolarChart = new Chart(ctx, {
            type: 'polarArea',
            data: {
                labels: labels,
                datasets: [{
                    data: momentumData,
                    backgroundColor: [
                        'rgba(236, 72, 153, 0.7)',
                        'rgba(147, 51, 234, 0.7)',
                        'rgba(99, 102, 241, 0.7)',
                        'rgba(59, 130, 246, 0.7)',
                        'rgba(14, 165, 233, 0.7)',
                        'rgba(6, 182, 212, 0.7)',
                        'rgba(20, 184, 166, 0.7)',
                        'rgba(16, 185, 129, 0.7)'
                    ],
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return context.label + ': ' + context.parsed.r.toFixed(1) + ' momentum';
                            }
                        }
                    }
                }
            }
        });
    }

    // ===================================
    // Bubble Charts
    // ===================================
    renderHabitBubbleChart() {
        const ctx = document.getElementById('habitBubbleChart');
        if (!ctx) return;
        
        if (this.habitBubbleChart) {
            this.habitBubbleChart.destroy();
        }
        
        const bubbleData = this.habits.map(habit => {
            const completions = this.getLast30DaysCompletions(habit.id);
            const possible = this.getLast30DaysPossible(habit);
            const completionRate = possible > 0 ? (completions / possible) * 100 : 0;
            
            return {
                x: habit.streak,
                y: completionRate,
                r: Math.sqrt(habit.totalCompletions) * 2,
                label: habit.name,
                color: habit.color
            };
        });
        
        this.habitBubbleChart = new Chart(ctx, {
            type: 'bubble',
            data: {
                datasets: [{
                    label: 'Habits Performance',
                    data: bubbleData,
                    backgroundColor: bubbleData.map(d => d.color + '80'),
                    borderColor: bubbleData.map(d => d.color),
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const item = bubbleData[context.dataIndex];
                                return [
                                    item.label,
                                    'Streak: ' + item.x + ' days',
                                    'Completion Rate: ' + item.y.toFixed(1) + '%',
                                    'Total Completions: ' + Math.round((item.r / 2) ** 2)
                                ];
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Current Streak (days)'
                        },
                        beginAtZero: true
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Completion Rate (%)'
                        },
                        beginAtZero: true,
                        max: 100
                    }
                }
            }
        });
    }

    renderCategoryBubbleChart() {
        const ctx = document.getElementById('categoryBubbleChart');
        if (!ctx) return;
        
        if (this.categoryBubbleChart) {
            this.categoryBubbleChart.destroy();
        }
        
        const categories = _.groupBy(this.habits, 'category');
        const bubbleData = Object.keys(categories).map(category => {
            const habits = categories[category];
            const avgStreak = habits.reduce((sum, h) => sum + h.streak, 0) / habits.length;
            const successRate = habits.reduce((sum, h) => {
                const completions = this.getLast30DaysCompletions(h.id);
                const possible = this.getLast30DaysPossible(h);
                return sum + (possible > 0 ? (completions / possible) * 100 : 0);
            }, 0) / habits.length;
            
            return {
                x: avgStreak,
                y: successRate,
                r: habits.length * 10,
                label: category.charAt(0).toUpperCase() + category.slice(1)
            };
        });
        
        const colors = [
            '#667eea', '#f093fb', '#4facfe', '#43e97b',
            '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'
        ];
        
        this.categoryBubbleChart = new Chart(ctx, {
            type: 'bubble',
            data: {
                datasets: [{
                    label: 'Categories',
                    data: bubbleData,
                    backgroundColor: bubbleData.map((_, i) => colors[i] + '80'),
                    borderColor: bubbleData.map((_, i) => colors[i]),
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const item = bubbleData[context.dataIndex];
                                return [
                                    item.label,
                                    'Avg Streak: ' + item.x.toFixed(1) + ' days',
                                    'Success Rate: ' + item.y.toFixed(1) + '%',
                                    'Habit Count: ' + (item.r / 10)
                                ];
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Average Streak (days)'
                        },
                        beginAtZero: true
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Success Rate (%)'
                        },
                        beginAtZero: true,
                        max: 100
                    }
                }
            }
        });
    }

    renderMultiDimensionalBubble() {
        const ctx = document.getElementById('multiDimensionalBubble');
        if (!ctx) return;
        
        if (this.multiDimensionalBubble) {
            this.multiDimensionalBubble.destroy();
        }
        
        const bubbleData = this.habits.map(habit => {
            const consistency = this.getLast30DaysCompletions(habit.id);
            const momentum = this.getLastNDaysCompletions(habit.id, 7) * 4.3; // Extrapolate to 30 days
            const size = habit.streak * 3;
            
            return {
                x: consistency,
                y: momentum,
                r: size,
                label: habit.name,
                color: habit.color
            };
        });
        
        this.multiDimensionalBubble = new Chart(ctx, {
            type: 'bubble',
            data: {
                datasets: [{
                    label: 'Multi-Dimensional Analysis',
                    data: bubbleData,
                    backgroundColor: bubbleData.map(d => d.color + '60'),
                    borderColor: bubbleData.map(d => d.color),
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const item = bubbleData[context.dataIndex];
                                return [
                                    item.label,
                                    'Consistency: ' + item.x + ' completions',
                                    'Momentum: ' + item.y.toFixed(1) + ' (projected)',
                                    'Streak: ' + (item.r / 3).toFixed(0) + ' days'
                                ];
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Consistency (30-day completions)'
                        },
                        beginAtZero: true
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Momentum (projected 30-day)'
                        },
                        beginAtZero: true
                    }
                }
            }
        });
    }

    // ===================================
    // Scatter Charts
    // ===================================
    renderStreakCompletionScatter() {
        const ctx = document.getElementById('streakCompletionScatter');
        if (!ctx) return;
        
        if (this.streakCompletionScatter) {
            this.streakCompletionScatter.destroy();
        }
        
        const scatterData = this.habits.map(habit => ({
            x: habit.streak,
            y: habit.totalCompletions,
            label: habit.name
        }));
        
        this.streakCompletionScatter = new Chart(ctx, {
            type: 'scatter',
            data: {
                datasets: [{
                    label: 'Habits',
                    data: scatterData,
                    backgroundColor: 'rgba(102, 126, 234, 0.6)',
                    borderColor: 'rgb(102, 126, 234)',
                    borderWidth: 2,
                    pointRadius: 6,
                    pointHoverRadius: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const item = scatterData[context.dataIndex];
                                return [
                                    item.label,
                                    'Streak: ' + item.x + ' days',
                                    'Total Completions: ' + item.y
                                ];
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Current Streak'
                        },
                        beginAtZero: true
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Total Completions'
                        },
                        beginAtZero: true
                    }
                }
            }
        });
    }

    renderTargetActualScatter() {
        const ctx = document.getElementById('targetActualScatter');
        if (!ctx) return;
        
        if (this.targetActualScatter) {
            this.targetActualScatter.destroy();
        }
        
        const scatterData = this.habits.map(habit => {
            const possible = this.getLast30DaysPossible(habit);
            const target = possible * habit.target;
            const actual = this.getLast30DaysCompletions(habit.id);
            
            return {
                x: target,
                y: actual,
                label: habit.name
            };
        });
        
        this.targetActualScatter = new Chart(ctx, {
            type: 'scatter',
            data: {
                datasets: [
                    {
                        label: 'Habits',
                        data: scatterData,
                        backgroundColor: 'rgba(240, 147, 251, 0.6)',
                        borderColor: 'rgb(240, 147, 251)',
                        borderWidth: 2,
                        pointRadius: 6,
                        pointHoverRadius: 8
                    },
                    {
                        label: 'Target Line',
                        data: [{x: 0, y: 0}, {x: 100, y: 100}],
                        type: 'line',
                        borderColor: 'rgba(34, 197, 94, 0.5)',
                        borderWidth: 2,
                        borderDash: [5, 5],
                        pointRadius: 0,
                        fill: false
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                if (context.datasetIndex === 0) {
                                    const item = scatterData[context.dataIndex];
                                    return [
                                        item.label,
                                        'Target: ' + item.x,
                                        'Actual: ' + item.y,
                                        'Achievement: ' + (item.x > 0 ? ((item.y / item.x) * 100).toFixed(1) : 0) + '%'
                                    ];
                                }
                                return '';
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Target (30 days)'
                        },
                        beginAtZero: true
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Actual Completions'
                        },
                        beginAtZero: true
                    }
                }
            }
        });
    }

    renderConsistencyFrequencyScatter() {
        const ctx = document.getElementById('consistencyFrequencyScatter');
        if (!ctx) return;
        
        if (this.consistencyFrequencyScatter) {
            this.consistencyFrequencyScatter.destroy();
        }
        
        const scatterData = this.habits.map(habit => {
            const completions = this.getLast30DaysCompletions(habit.id);
            const possible = this.getLast30DaysPossible(habit);
            const consistency = possible > 0 ? (completions / possible) * 100 : 0;
            
            return {
                x: possible,
                y: consistency,
                label: habit.name
            };
        });
        
        this.consistencyFrequencyScatter = new Chart(ctx, {
            type: 'scatter',
            data: {
                datasets: [{
                    label: 'Habits',
                    data: scatterData,
                    backgroundColor: 'rgba(67, 233, 123, 0.6)',
                    borderColor: 'rgb(67, 233, 123)',
                    borderWidth: 2,
                    pointRadius: 6,
                    pointHoverRadius: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const item = scatterData[context.dataIndex];
                                return [
                                    item.label,
                                    'Frequency: ' + item.x + ' times/30d',
                                    'Consistency: ' + item.y.toFixed(1) + '%'
                                ];
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Expected Frequency (30 days)'
                        },
                        beginAtZero: true
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Consistency (%)'
                        },
                        beginAtZero: true,
                        max: 100
                    }
                }
            }
        });
    }

    // ===================================
    // Correlation Heatmap
    // ===================================
    renderCorrelationHeatmap() {
        const container = document.getElementById('correlationHeatmap');
        if (!container) return;
        
        if (this.habits.length < 2) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-chart-line"></i>
                    <h3>Not enough data</h3>
                    <p>Add more habits to see correlation analysis</p>
                </div>
            `;
            return;
        }
        
        // Calculate correlation matrix
        const topHabits = [...this.habits]
            .sort((a, b) => b.totalCompletions - a.totalCompletions)
            .slice(0, 6);
        
        const correlationMatrix = [];
        
        topHabits.forEach(habit1 => {
            const row = [];
            topHabits.forEach(habit2 => {
                if (habit1.id === habit2.id) {
                    row.push(1);
                } else {
                    row.push(this.calculateCorrelation(habit1.id, habit2.id));
                }
            });
            correlationMatrix.push(row);
        });
        
        // Generate heatmap HTML
        let html = '<div class="correlation-header">';
        topHabits.forEach(habit => {
            html += `<div class="correlation-header-label">${habit.name}</div>`;
        });
        html += '</div>';
        
        topHabits.forEach((habit, i) => {
            html += '<div class="correlation-row">';
            html += `<div class="correlation-label">${habit.name}</div>`;
            html += '<div class="correlation-cells">';
            
            correlationMatrix[i].forEach((value, j) => {
                const intensity = Math.abs(value);
                const hue = value >= 0 ? 120 : 0; // Green for positive, red for negative
                const color = `hsla(${hue}, 70%, ${50 + intensity * 20}%, 0.8)`;
                
                html += `<div class="correlation-cell" 
                              style="background: ${color};" 
                              data-value="${value.toFixed(2)}"
                              title="${topHabits[i].name} ↔ ${topHabits[j].name}: ${(value * 100).toFixed(0)}%">
                         </div>`;
            });
            
            html += '</div></div>';
        });
        
        html += `
            <div class="correlation-legend">
                <div class="correlation-legend-item">
                    <div class="correlation-legend-color" style="background: linear-gradient(to right, hsla(0, 70%, 50%, 0.8), hsla(120, 70%, 50%, 0.8));"></div>
                    <span>Negative ← → Positive Correlation</span>
                </div>
            </div>
        `;
        
        container.innerHTML = html;
    }

    calculateCorrelation(habitId1, habitId2) {
        const dateRange = this.getDateRangeData();
        const completions1 = [];
        const completions2 = [];
        
        dateRange.forEach(date => {
            const dateStr = date.format('YYYY-MM-DD');
            const comp1 = this.completions[dateStr] && this.completions[dateStr][habitId1] ? 1 : 0;
            const comp2 = this.completions[dateStr] && this.completions[dateStr][habitId2] ? 1 : 0;
            completions1.push(comp1);
            completions2.push(comp2);
        });
        
        // Calculate Pearson correlation coefficient
        const n = completions1.length;
        if (n === 0) return 0;
        
        const sum1 = completions1.reduce((a, b) => a + b, 0);
        const sum2 = completions2.reduce((a, b) => a + b, 0);
        const sum1Sq = completions1.reduce((a, b) => a + b * b, 0);
        const sum2Sq = completions2.reduce((a, b) => a + b * b, 0);
        const pSum = completions1.reduce((a, b, i) => a + b * completions2[i], 0);
        
        const num = pSum - (sum1 * sum2 / n);
        const den = Math.sqrt((sum1Sq - sum1 * sum1 / n) * (sum2Sq - sum2 * sum2 / n));
        
        return den === 0 ? 0 : num / den;
    }

    getLastNDaysCompletions(habitId, days) {
        let count = 0;
        for (let i = 0; i < days; i++) {
            const date = moment().subtract(i, 'days').format('YYYY-MM-DD');
            if (this.completions[date] && this.completions[date][habitId]) {
                count++;
            }
        }
        return count;
    }

    // ===================================
    // Calendar Rendering
    // ===================================
    renderCalendar() {
        const year = this.currentMonth.year();
        const month = this.currentMonth.month();
        
        this.elements.calendarMonth.textContent = this.currentMonth.format('MMMM YYYY');
        
        const firstDay = moment([year, month, 1]);
        const lastDay = moment([year, month]).endOf('month');
        const startDate = firstDay.clone().startOf('week');
        const endDate = lastDay.clone().endOf('week');
        
        const days = [];
        const current = startDate.clone();
        
        // Add day headers
        const dayHeaders = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        dayHeaders.forEach(day => {
            days.push(`<div class="calendar-day header">${day}</div>`);
        });
        
        // Add calendar days
        while (current.isSameOrBefore(endDate)) {
            const dateStr = current.format('YYYY-MM-DD');
            const isCurrentMonth = current.month() === month;
            const isToday = current.isSame(moment(), 'day');
            const isPast = current.isBefore(moment(), 'day');
            
            let classes = 'calendar-day';
            if (!isCurrentMonth) classes += ' other-month';
            if (isToday) classes += ' today';
            
            // Check completion status
            if (isPast || isToday) {
                const dayHabits = this.habits.filter(h => {
                    if (h.frequency === 'daily') return true;
                    return h.selectedDays.includes(current.day());
                });
                
                const completed = this.completions[dateStr] ? 
                    Object.keys(this.completions[dateStr]).length : 0;
                
                if (dayHabits.length > 0) {
                    const rate = (completed / dayHabits.length);
                    if (rate >= 0.8) {
                        classes += ' completed';
                    } else if (rate > 0) {
                        // Partial completion - could add a different style
                    } else if (isPast) {
                        classes += ' missed';
                    }
                }
            }
            
            days.push(`
                <div class="${classes}">
                    <span>${current.date()}</span>
                </div>
            `);
            
            current.add(1, 'day');
        }
        
        this.elements.calendarGrid.innerHTML = days.join('');
    }

    // ===================================
    // Settings
    // ===================================
    renderSettings() {
        this.elements.themeSelect.value = this.settings.theme;
        this.elements.reminderTime.value = this.settings.reminderTime;
        this.elements.enableNotifications.checked = this.settings.notifications;
    }

    applyTheme() {
        const theme = this.settings.theme === 'auto' ? 
            (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : 
            this.settings.theme;
        
        document.documentElement.setAttribute('data-theme', theme);
        
        const icon = this.elements.themeToggle.querySelector('i');
        icon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    }

    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        this.settings.theme = newTheme;
        this.applyTheme();
        this.saveData();
    }

    // ===================================
    // Modal Management
    // ===================================
    openHabitModal(habitId = null) {
        this.editingHabitId = habitId;
        
        if (habitId) {
            const habit = this.habits.find(h => h.id === habitId);
            if (habit) {
                this.elements.modalTitle.textContent = 'Edit Habit';
                this.populateHabitForm(habit);
            }
        } else {
            this.elements.modalTitle.textContent = 'Add New Habit';
            this.elements.habitForm.reset();
            this.elements.frequencyBtns[0].classList.add('active');
            this.elements.frequencyBtns.forEach((btn, i) => {
                if (i !== 0) btn.classList.remove('active');
            });
            this.elements.daysSelection.style.display = 'none';
        }
        
        this.elements.habitModal.classList.add('active');
        this.elements.habitModal.querySelector('.modal-content').classList.add('animate__bounceIn');
    }

    closeHabitModal() {
        this.elements.habitModal.classList.remove('active');
        this.editingHabitId = null;
    }

    populateHabitForm(habit) {
        this.elements.habitName.value = habit.name;
        this.elements.habitDescription.value = habit.description || '';
        this.elements.habitCategory.value = habit.category;
        this.elements.habitIcon.value = habit.icon;
        this.elements.habitColor.value = habit.color;
        this.elements.habitTarget.value = habit.target;
        this.elements.habitReminder.value = habit.reminderTime || '';
        
        // Set frequency
        this.elements.frequencyBtns.forEach(btn => btn.classList.remove('active'));
        const freqBtn = Array.from(this.elements.frequencyBtns).find(b => b.dataset.freq === habit.frequency);
        if (freqBtn) freqBtn.classList.add('active');
        
        // Set selected days
        if (habit.frequency === 'custom') {
            this.elements.daysSelection.style.display = 'block';
            this.elements.dayBtns.forEach(btn => {
                const day = parseInt(btn.dataset.day);
                if (habit.selectedDays.includes(day)) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });
        }
    }

    handleHabitSubmit(e) {
        e.preventDefault();
        
        const activeFreqBtn = document.querySelector('.freq-btn.active');
        const frequency = activeFreqBtn ? activeFreqBtn.dataset.freq : 'daily';
        
        const selectedDays = frequency === 'custom' ? 
            Array.from(document.querySelectorAll('.day-btn.active')).map(btn => parseInt(btn.dataset.day)) :
            frequency === 'weekly' ? [moment().day()] : [0, 1, 2, 3, 4, 5, 6];
        
        const habitData = {
            name: this.elements.habitName.value.trim(),
            description: this.elements.habitDescription.value.trim(),
            category: this.elements.habitCategory.value,
            icon: this.elements.habitIcon.value,
            color: this.elements.habitColor.value,
            target: this.elements.habitTarget.value,
            frequency: frequency,
            selectedDays: selectedDays,
            reminderTime: this.elements.habitReminder.value || null
        };
        
        if (this.editingHabitId) {
            this.updateHabit(this.editingHabitId, habitData);
        } else {
            this.addHabit(habitData);
        }
        
        this.closeHabitModal();
        this.renderDashboard();
        
        if (this.currentView === 'habits') {
            this.renderHabitsView();
        }
    }

    editHabit(habitId) {
        this.openHabitModal(habitId);
    }

    // ===================================
    // Notifications
    // ===================================
    addNotification(title, message) {
        const notification = {
            id: Date.now().toString(),
            title,
            message,
            timestamp: moment().format('YYYY-MM-DD HH:mm:ss'),
            read: false
        };
        
        this.notifications.unshift(notification);
        
        // Keep only last 50 notifications
        if (this.notifications.length > 50) {
            this.notifications = this.notifications.slice(0, 50);
        }
        
        this.saveData();
        this.renderNotifications();
        
        // Show toast notification
        if (this.settings.notifications) {
            this.showToast(message, 'info');
        }
    }

    renderNotifications() {
        const unreadCount = this.notifications.filter(n => !n.read).length;
        this.elements.notificationBadge.textContent = unreadCount;
        this.elements.notificationBadge.style.display = unreadCount > 0 ? 'flex' : 'none';
        
        if (this.notifications.length === 0) {
            this.elements.notificationList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-bell"></i>
                    <h3>No notifications</h3>
                    <p>You're all caught up!</p>
                </div>
            `;
            return;
        }
        
        this.elements.notificationList.innerHTML = this.notifications.map(notif => `
            <div class="notification-item ${notif.read ? '' : 'unread'}">
                <h4>${notif.title}</h4>
                <p>${notif.message}</p>
                <small>${moment(notif.timestamp).fromNow()}</small>
            </div>
        `).join('');
    }

    showToast(message, type = 'info') {
        const backgrounds = {
            success: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
            error: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
            info: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
            warning: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)'
        };
        
        Toastify({
            text: message,
            duration: 3000,
            gravity: 'top',
            position: 'right',
            style: {
                background: backgrounds[type] || backgrounds.info,
                borderRadius: '12px',
                fontWeight: '500'
            }
        }).showToast();
    }

    // ===================================
    // Utility Functions
    // ===================================
    updateDate() {
        const now = moment();
        this.elements.currentDate.textContent = now.format('dddd, MMMM D, YYYY');
        
        // Update every minute
        setTimeout(() => this.updateDate(), 60000);
    }

    saveHabitOrder() {
        const habitElements = Array.from(this.elements.todaysHabits.querySelectorAll('.habit-item'));
        const newOrder = habitElements.map(el => el.dataset.id);
        
        // Reorder habits array based on new order
        this.habits.sort((a, b) => {
            const indexA = newOrder.indexOf(a.id);
            const indexB = newOrder.indexOf(b.id);
            if (indexA === -1) return 1;
            if (indexB === -1) return -1;
            return indexA - indexB;
        });
        
        this.saveData();
    }

    // ===================================
    // Demo Data Generator (for testing)
    // ===================================
    generateDemoData() {
        if (this.habits.length > 0) {
            if (!confirm('This will replace all existing data with demo data. Continue?')) {
                return;
            }
        }
        
        const demoHabits = [
            {
                id: '1',
                name: 'Morning Exercise',
                description: '30 minutes of cardio or strength training',
                category: 'health',
                icon: 'fa-dumbbell',
                color: '#667eea',
                target: 1,
                frequency: 'daily',
                selectedDays: [0, 1, 2, 3, 4, 5, 6],
                reminderTime: '07:00',
                createdAt: moment().subtract(30, 'days').format('YYYY-MM-DD'),
                streak: 15,
                bestStreak: 21,
                totalCompletions: 45
            },
            {
                id: '2',
                name: 'Read 20 Pages',
                description: 'Read books for personal development',
                category: 'learning',
                icon: 'fa-book',
                color: '#f093fb',
                target: 1,
                frequency: 'daily',
                selectedDays: [0, 1, 2, 3, 4, 5, 6],
                reminderTime: '21:00',
                createdAt: moment().subtract(25, 'days').format('YYYY-MM-DD'),
                streak: 12,
                bestStreak: 18,
                totalCompletions: 38
            },
            {
                id: '3',
                name: 'Meditation',
                description: '10 minutes of mindfulness meditation',
                category: 'mindfulness',
                icon: 'fa-spa',
                color: '#4facfe',
                target: 1,
                frequency: 'daily',
                selectedDays: [0, 1, 2, 3, 4, 5, 6],
                reminderTime: '08:00',
                createdAt: moment().subtract(20, 'days').format('YYYY-MM-DD'),
                streak: 8,
                bestStreak: 14,
                totalCompletions: 32
            },
            {
                id: '4',
                name: 'Drink 8 Glasses of Water',
                description: 'Stay hydrated throughout the day',
                category: 'health',
                icon: 'fa-water',
                color: '#43e97b',
                target: 8,
                frequency: 'daily',
                selectedDays: [0, 1, 2, 3, 4, 5, 6],
                reminderTime: null,
                createdAt: moment().subtract(15, 'days').format('YYYY-MM-DD'),
                streak: 10,
                bestStreak: 12,
                totalCompletions: 28
            },
            {
                id: '5',
                name: 'Code Practice',
                description: 'Work on coding projects or practice algorithms',
                category: 'productivity',
                icon: 'fa-code',
                color: '#f59e0b',
                target: 1,
                frequency: 'custom',
                selectedDays: [1, 2, 3, 4, 5],
                reminderTime: '19:00',
                createdAt: moment().subtract(10, 'days').format('YYYY-MM-DD'),
                streak: 5,
                bestStreak: 7,
                totalCompletions: 15
            }
        ];
        
        this.habits = demoHabits;
        
        // Generate some completion history
        for (let i = 0; i < 30; i++) {
            const date = moment().subtract(i, 'days').format('YYYY-MM-DD');
            this.completions[date] = {};
            
            // Randomly complete habits with higher probability for recent days
            demoHabits.forEach(habit => {
                const probability = Math.random();
                const dayOfWeek = moment(date).day();
                
                // Check if habit is active on this day
                const isActive = habit.frequency === 'daily' || habit.selectedDays.includes(dayOfWeek);
                
                if (isActive && probability > (i * 0.02)) { // Less completion for older dates
                    this.completions[date][habit.id] = {
                        completed: true,
                        timestamp: moment(date).add(Math.floor(Math.random() * 24), 'hours').format('YYYY-MM-DD HH:mm:ss')
                    };
                }
            });
        }
        
        this.saveData();
        this.renderDashboard();
        this.showToast('Demo data generated successfully!', 'success');
        this.addNotification('Demo Data', 'Sample habits and completion history have been created.');
    }
}

// ===================================
// Initialize Application
// ===================================
let app;

document.addEventListener('DOMContentLoaded', () => {
    app = new HabitTrackerApp();
    
    // Expose generateDemoData for console access
    window.generateDemoData = () => app.generateDemoData();
    
    // Add keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Ctrl/Cmd + N: New habit
        if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
            e.preventDefault();
            app.openHabitModal();
        }
        
        // Escape: Close modal
        if (e.key === 'Escape') {
            if (app.elements.habitModal.classList.contains('active')) {
                app.closeHabitModal();
            }
            if (app.elements.notificationPanel.classList.contains('active')) {
                app.elements.notificationPanel.classList.remove('active');
            }
        }
    });
    
    // Handle visibility change to update streak when returning to tab
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            app.checkDailyReset();
            app.updateDate();
            if (app.currentView === 'dashboard') {
                app.renderDashboard();
            }
        }
    });
    
    // Log helpful message to console
    console.log('%c🎯 HabitFlow Tracker', 'font-size: 24px; font-weight: bold; color: #667eea;');
    console.log('%cTip: Type generateDemoData() in console to add sample data', 'font-size: 14px; color: #64748b;');
    console.log('%cKeyboard Shortcuts:', 'font-size: 16px; font-weight: bold; color: #667eea; margin-top: 10px;');
    console.log('%c  • Ctrl/Cmd + N: Add new habit', 'font-size: 14px; color: #64748b;');
    console.log('%c  • Escape: Close modal/panel', 'font-size: 14px; color: #64748b;');
});

// ===================================
// Service Worker Registration (PWA)
// ===================================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        // Register service worker for PWA capabilities
        // This would be implemented in a production environment
    });
}

// ===================================
// Utility: Export to CSV
// ===================================
function exportToCSV() {
    const habits = app.habits;
    const completions = app.completions;
    
    let csv = 'Date,Habit,Completed,Category,Streak\n';
    
    Object.keys(completions).sort().forEach(date => {
        Object.keys(completions[date]).forEach(habitId => {
            const habit = habits.find(h => h.id === habitId);
            if (habit) {
                csv += `${date},${habit.name},Yes,${habit.category},${habit.streak}\n`;
            }
        });
    });
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `habit-tracker-export-${moment().format('YYYY-MM-DD')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    
    app.showToast('CSV exported successfully', 'success');
}

// ===================================
// Analytics Helpers
// ===================================
function calculateConsistencyScore() {
    const last30Days = [];
    for (let i = 0; i < 30; i++) {
        last30Days.push(moment().subtract(i, 'days').format('YYYY-MM-DD'));
    }
    
    let totalPossible = 0;
    let totalCompleted = 0;
    
    last30Days.forEach(date => {
        const dayOfWeek = moment(date).day();
        const activeHabits = app.habits.filter(h => {
            if (h.frequency === 'daily') return true;
            return h.selectedDays.includes(dayOfWeek);
        });
        
        totalPossible += activeHabits.length;
        
        if (app.completions[date]) {
            totalCompleted += Object.keys(app.completions[date]).length;
        }
    });
    
    return totalPossible > 0 ? Math.round((totalCompleted / totalPossible) * 100) : 0;
}

// ===================================
// Advanced Features
// ===================================

// Gamification: Achievement System
class AchievementSystem {
    static achievements = [
        { id: 'first_habit', name: 'Getting Started', description: 'Add your first habit', icon: 'fa-star' },
        { id: 'week_streak', name: 'Week Warrior', description: '7 day streak on any habit', icon: 'fa-fire' },
        { id: 'month_streak', name: 'Monthly Master', description: '30 day streak on any habit', icon: 'fa-trophy' },
        { id: 'perfect_day', name: 'Perfect Day', description: 'Complete all habits in a day', icon: 'fa-check-circle' },
        { id: 'early_bird', name: 'Early Bird', description: 'Complete a habit before 8 AM', icon: 'fa-sun' },
        { id: 'night_owl', name: 'Night Owl', description: 'Complete a habit after 10 PM', icon: 'fa-moon' },
        { id: 'century', name: 'Century Club', description: '100 total completions', icon: 'fa-award' },
        { id: 'diverse', name: 'Well Rounded', description: 'Have habits in 5 different categories', icon: 'fa-palette' }
    ];
    
    static checkAchievements(app) {
        const unlocked = [];
        
        // Check each achievement
        if (app.habits.length >= 1 && !app.hasAchievement('first_habit')) {
            unlocked.push(this.achievements.find(a => a.id === 'first_habit'));
        }
        
        if (app.habits.some(h => h.streak >= 7) && !app.hasAchievement('week_streak')) {
            unlocked.push(this.achievements.find(a => a.id === 'week_streak'));
        }
        
        if (app.habits.some(h => h.streak >= 30) && !app.hasAchievement('month_streak')) {
            unlocked.push(this.achievements.find(a => a.id === 'month_streak'));
        }
        
        const totalCompletions = app.habits.reduce((sum, h) => sum + h.totalCompletions, 0);
        if (totalCompletions >= 100 && !app.hasAchievement('century')) {
            unlocked.push(this.achievements.find(a => a.id === 'century'));
        }
        
        const categories = new Set(app.habits.map(h => h.category));
        if (categories.size >= 5 && !app.hasAchievement('diverse')) {
            unlocked.push(this.achievements.find(a => a.id === 'diverse'));
        }
        
        return unlocked;
    }
}

// Make exportToCSV available globally
window.exportToCSV = exportToCSV;

console.log('%c✨ Advanced features loaded!', 'font-size: 14px; color: #43e97b;');
