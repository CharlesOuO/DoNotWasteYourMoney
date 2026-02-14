// 等待網頁載入完成後再執行，防止找不到元素
document.addEventListener('DOMContentLoaded', function() {
    initApp();
});

// --- 變數宣告 ---
let chartInstance = null;
let recoveredChartInstance = null;
let expenses = [];
let appTitle = "許凱琳在前女友身上花多少錢";

// 狀態變數
let currentActionIndex = -1;
let tempDeleteReason = "";
let gameStage = 0;
let currentGameQueue = [];

// 定義常數
const catIcons = { "飲食": "🍔", "禮物": "🎁", "生活": "🏠", "交通": "🚗", "娛樂": "🎬", "借款": "💸", "其他": "💩" };
const catColors = { "飲食": "#ffeaa7", "禮物": "#ff7675", "生活": "#74b9ff", "交通": "#a29bfe", "娛樂": "#fd79a8", "借款": "#55efc4", "其他": "#dfe6e9" };
const quotes = ["投資自己，穩賺不賠。", "你值得被珍惜，不是被利用。", "別回頭，更好的人在前面。", "拒絕是你成熟的第一步。", "單身代表你終於自由了。", "不要做廉價的提款機。", "刪除紀錄不代表沒發生過。", "別讓回憶成為你的負債。", "拿回一塊錢，就是贏一塊錢。"];
const phrases = ["回頭是岸", "及時止損", "愛惜自己", "不再犯賤", "保持清醒", "拒絕勒索", "我是最棒的", "下一個更好", "遠離渣男", "單身萬歲", "錢要自己花", "腦袋要清楚", "別當提款機", "舊的不去，新的不來"];

// --- 初始化應用程式 ---
function initApp() {
    // 1. 讀取標題
    appTitle = localStorage.getItem('app_title') || appTitle;
    const titleEl = document.getElementById('app-title-display');
    if (titleEl) {
        titleEl.innerHTML = appTitle + ' <i class="fa-solid fa-pen" style="font-size:0.8rem; opacity:0.5;"></i>';
    }
    document.title = appTitle;

    // 2. 隨機金句
    const quoteEl = document.getElementById('quote-text');
    if (quoteEl) quoteEl.textContent = quotes[Math.floor(Math.random() * quotes.length)];

    // 3. 讀取資料
    expenses = JSON.parse(localStorage.getItem('ex_expenses_v3')) || [];
    // 資料格式遷移 (防止舊資料報錯)
    expenses = expenses.map(e => ({
        ...e,
        category: e.category || '其他',
        date: e.date || '過往',
        recovered: e.recovered || 0,
        isSettled: e.isSettled || false
    }));

    // 4. 綁定按鈕事件 (使用 addEventListener 避免 HTML onclick 失效)
    const addBtn = document.getElementById('add-btn');
    if (addBtn) addBtn.addEventListener('click', addItem);

    const gameInput = document.getElementById('game-answer');
    if (gameInput) {
        gameInput.addEventListener("keypress", (e) => {
            if (e.key === "Enter") checkGameAnswer();
        });
    }
    
    // 檔案匯入監聽
    const importFile = document.getElementById('import-file');
    if(importFile) importFile.addEventListener('change', function() { importData(this); });

    // 5. 初始化 UI
    updateUI();
    
    // 6. 預設選中第一個 Tab
    const firstNav = document.querySelector('.nav-item');
    if(firstNav) firstNav.classList.add('active');
}

// --- 將函式綁定到 window (讓 HTML onclick 讀得到) ---
window.switchTab = function(tabName) {
    document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
    const target = document.getElementById(`view-${tabName}`);
    if (target) target.classList.add('active');
    
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    // 這裡需要透過 event 獲取點擊對象，若無 event 則忽略
    if(event && event.currentTarget) event.currentTarget.classList.add('active');
    
    updateUI();
};

window.changeTitle = function() {
    const newTitle = prompt("請輸入新的標題：", appTitle);
    if(newTitle && newTitle.trim() !== "") {
        appTitle = newTitle;
        localStorage.setItem('app_title', appTitle);
        const titleEl = document.getElementById('app-title-display');
        if(titleEl) titleEl.innerHTML = appTitle + ' <i class="fa-solid fa-pen" style="font-size:0.8rem; opacity:0.5;"></i>';
        document.title = appTitle;
    }
};

window.clearAllData = function() {
    if(confirm("⚠️ 警告：這將會刪除所有紀錄，確定嗎？")) {
        if(prompt("請輸入「確認刪除」四個字：") === "確認刪除") {
            expenses = [];
            localStorage.removeItem('ex_expenses_v3');
            updateUI();
            alert("資料已重置");
        }
    }
};

window.exportData = function() {
    const dataStr = JSON.stringify(expenses, null, 4);
    const blob = new Blob([dataStr], {type: "application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `breakup_backup_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
};

window.shareStats = function() {
    const net = document.getElementById('stat-net')?.textContent || "$0";
    const total = document.getElementById('stat-total')?.textContent || "$0";
    const back = document.getElementById('stat-recovered')?.textContent || "$0";
    const text = `【分手戰績】\n我在前任身上花了 ${total}，\n目前已討回 ${back}，\n實際虧損 ${net}。\n#單身重生基金`;
    navigator.clipboard.writeText(text).then(() => alert("已複製到剪貼簿！"));
};

// 檔案匯入邏輯
function importData(input) {
    const file = input.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            expenses = JSON.parse(e.target.result);
            updateUI();
            alert("匯入成功！");
        } catch(err) {
            alert("檔案格式錯誤");
        }
    };
    reader.readAsText(file);
}

// --- 核心 UI 更新邏輯 ---
function updateUI() {
    let total = 0, totalRecovered = 0;
    let categoryTotals = {}, recoveredCategoryTotals = {};
    const categories = ["飲食", "禮物", "生活", "交通", "娛樂", "借款", "其他"];
    categories.forEach(c => { categoryTotals[c] = 0; recoveredCategoryTotals[c] = 0; });

    // 渲染支出列表
    const spentListEl = document.getElementById('spent-list');
    if (spentListEl) {
        spentListEl.innerHTML = '';
        if (expenses.length === 0) spentListEl.innerHTML = '<div class="empty-state">目前很清醒，沒有任何紀錄 ✨</div>';
        
        expenses.forEach((item, index) => {
            const cost = Number(item.cost), recovered = Number(item.recovered);
            total += cost; 
            totalRecovered += recovered;
            categoryTotals[item.category] = (categoryTotals[item.category] || 0) + cost;
            if(recovered > 0) recoveredCategoryTotals[item.category] = (recoveredCategoryTotals[item.category] || 0) + recovered;

            const isFullySettled = recovered >= cost;
            const li = createExpenseItem(item, index, isFullySettled, cost, recovered);
            spentListEl.appendChild(li);
        });
    }

    // 渲染討回列表
    const recoveredListEl = document.getElementById('recovered-list');
    if (recoveredListEl) {
        recoveredListEl.innerHTML = '';
        const recoveredItems = expenses.filter(e => e.recovered > 0);
        if (recoveredItems.length === 0) recoveredListEl.innerHTML = '<div class="empty-state">還沒討回任何錢，加油 💪</div>';
        else {
            recoveredItems.forEach(item => {
                const li = document.createElement('li');
                li.className = item.isSettled ? 'is-settled' : '';
                const iconBg = catColors[item.category] || "#dfe6e9";
                li.innerHTML = `
                    <div class="item-left">
                        <div class="cat-icon" style="background:${iconBg}40; color:#2d3436;">${catIcons[item.category]||'💩'}</div>
                        <div class="item-details"><span class="item-name">${item.name}</span><span class="item-meta">拿回 / 總額</span></div>
                    </div>
                    <div class="item-right">
                        <div class="item-price recovered-val" style="color:var(--accent-gain);">+$${item.recovered.toLocaleString()}</div>
                        <div style="font-size:0.7rem; color:#b2bec3;">of $${item.cost.toLocaleString()}</div>
                    </div>`;
                recoveredListEl.appendChild(li);
            });
        }
    }

    // 更新數字
    const netLoss = total - totalRecovered;
    const setText = (id, val) => { const el = document.getElementById(id); if(el) el.textContent = val; };
    
    setText('stat-net', `$${netLoss.toLocaleString()}`);
    setText('stat-total', `$${total.toLocaleString()}`);
    setText('stat-recovered', `$${totalRecovered.toLocaleString()}`);
    setText('page-recovered-val', `$${totalRecovered.toLocaleString()}`);

    // 綠色模式切換
    const mainHeader = document.getElementById('main-header');
    const navContainer = document.querySelector('.bottom-nav');
    if (mainHeader && navContainer) {
        if (netLoss <= 0 && expenses.length > 0) {
            mainHeader.classList.add('green-mode');
            navContainer.classList.add('green-mode');
        } else {
            mainHeader.classList.remove('green-mode');
            navContainer.classList.remove('green-mode');
        }
    }

    updateConversion(netLoss);
    updateChart(categoryTotals, netLoss);
    updateRecoveredChart(recoveredCategoryTotals, totalRecovered);
    localStorage.setItem('ex_expenses_v3', JSON.stringify(expenses));
}

function createExpenseItem(item, index, isFullySettled, cost, recovered) {
    const li = document.createElement('li');
    li.className = isFullySettled ? 'is-settled' : '';
    
    let priceHTML = `<div class="item-price ${isFullySettled ? 'settled' : ''}">$${cost.toLocaleString()}</div>`;
    if(recovered > 0 && !isFullySettled) priceHTML += `<div style="font-size:0.7rem; color:#00b894;">+$${recovered.toLocaleString()}</div>`;
    
    let btnsHTML = isFullySettled 
        ? `<button class="btn-mini btn-settled">已結清</button> <button class="btn-mini btn-del" onclick="openDeleteModal(${index})">✕</button>`
        : `<button class="btn-mini btn-recover" onclick="openRecoverModal(${index})">討回</button> <button class="btn-mini btn-del" onclick="openDeleteModal(${index})">刪除</button>`;
    
    const iconBg = catColors[item.category] || "#dfe6e9";
    li.innerHTML = `
        <div class="item-left">
            <div class="cat-icon" style="background:${iconBg}40; color:#2d3436;">${catIcons[item.category]||'💩'}</div>
            <div class="item-details"><span class="item-name">${item.name}</span><span class="item-meta">${item.date} · ${item.category}</span></div>
        </div>
        <div class="item-right">${priceHTML}<div class="action-btns">${btnsHTML}</div></div>`;
    return li;
}

function updateConversion(net) {
    const el = document.getElementById('conversion-text');
    if (!el) return;
    
    if (net <= 0 && expenses.length > 0) el.textContent = "太強了！錢都拿回來了！👏";
    else if (net > 0) el.textContent = `虧損可買 ${(net/150).toFixed(0)} 杯星巴克 ☕`;
    else el.textContent = "保持清醒，錢包安全！";
    
    if (net > 5000) el.textContent = `夠買廉航機票飛日本了 ✈️`;
    if (net > 15000) el.textContent = `夠買一台 iPad Air 了 📱`;
    if (net > 30000) el.textContent = `你浪費了一台高階筆電 💻`;
}

function updateChart(dataMap, netAmount) {
    const canvas = document.getElementById('expenseChart');
    if (!canvas) return; // 防呆：如果找不到 canvas 就不畫圖
    
    const ctx = canvas.getContext('2d');
    let labels = [], dataValues = [], bgColors = [];
    if (netAmount <= 0 && expenses.length > 0) { labels = ["恭喜無虧損"]; dataValues = [1]; bgColors = ["#00b894"]; }
    else if (expenses.length === 0) { labels = ["尚無紀錄"]; dataValues = [1]; bgColors = ["#f1f2f6"]; }
    else { labels = Object.keys(dataMap); dataValues = Object.values(dataMap); bgColors = ['#ff7675', '#74b9ff', '#ffeaa7', '#a29bfe', '#fd79a8', '#55efc4', '#636e72']; }
    
    if (chartInstance) chartInstance.destroy();
    chartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: { labels, datasets: [{ data: dataValues, backgroundColor: bgColors, borderWidth: 0 }] },
        options: { responsive: true, maintainAspectRatio: false, cutout: '70%', plugins: { legend: { display: false } } }
    });
}

function updateRecoveredChart(dataMap, totalRecovered) {
    const canvas = document.getElementById('recoveredChart');
    if (!canvas) return; // 防呆
    
    const ctx = canvas.getContext('2d');
    let labels = [], dataValues = [], bgColors = [];
    if (totalRecovered === 0) { labels = ["尚未討回"]; dataValues = [1]; bgColors = ["#f1f2f6"]; }
    else { labels = Object.keys(dataMap); dataValues = Object.values(dataMap); bgColors = ['#ff7675', '#74b9ff', '#ffeaa7', '#a29bfe', '#fd79a8', '#55efc4', '#636e72']; }
    
    if (recoveredChartInstance) recoveredChartInstance.destroy();
    recoveredChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: { labels, datasets: [{ data: dataValues, backgroundColor: bgColors, borderWidth: 0 }] },
        options: { responsive: true, maintainAspectRatio: false, cutout: '70%', plugins: { legend: { display: false } } }
    });
}

function addItem() {
    const nameEl = document.getElementById('item-name');
    const costEl = document.getElementById('item-cost');
    const catEl = document.getElementById('item-category');
    
    if (!nameEl || !costEl || !catEl) return;

    const name = nameEl.value.trim();
    const cost = costEl.value;
    const category = catEl.value;

    if (!name || !cost) { alert('請輸入項目與金額'); return; }
    
    const today = new Date();
    expenses.unshift({ name, cost, category, date: `${today.getMonth()+1}/${today.getDate()}`, recovered: 0, isSettled: false });
    nameEl.value = ''; costEl.value = '';
    updateUI();
}

// --- Modal 相關全域函式 ---
const recoverModal = document.getElementById('recover-modal');
const recoverInput = document.getElementById('recover-input');
const recoverMsg = document.getElementById('recover-msg');

window.openRecoverModal = function(index) {
    currentActionIndex = index;
    const item = expenses[index];
    const remaining = item.cost - item.recovered;
    if(recoverMsg) recoverMsg.textContent = `「${item.name}」還差 $${remaining.toLocaleString()}，這次拿回多少？`;
    if(recoverInput) recoverInput.value = remaining;
    if(recoverModal) {
        recoverModal.style.display = 'flex';
        setTimeout(() => recoverInput.focus(), 100);
    }
};

window.closeRecoverModal = function() { if(recoverModal) recoverModal.style.display = 'none'; };

window.confirmRecover = function() {
    if(!recoverInput) return;
    const amount = parseInt(recoverInput.value);
    if (!isNaN(amount) && amount > 0) {
        const item = expenses[currentActionIndex];
        const maxRecover = item.cost - item.recovered;
        const actualRecover = Math.min(amount, maxRecover);
        
        item.recovered += actualRecover;
        if (item.recovered >= item.cost) {
            item.isSettled = true;
            alert("🎉 恭喜結清！");
        }
        updateUI();
        closeRecoverModal();
    } else {
        alert("請輸入有效金額");
    }
};

const deleteModal = document.getElementById('delete-modal');
const deleteReasonInput = document.getElementById('delete-reason-input');

window.openDeleteModal = function(index) {
    currentActionIndex = index;
    if(deleteReasonInput) deleteReasonInput.value = '';
    if(deleteModal) {
        deleteModal.style.display = 'flex';
        setTimeout(() => deleteReasonInput.focus(), 100);
    }
};

window.closeDeleteModal = function() { if(deleteModal) deleteModal.style.display = 'none'; };

window.confirmDeleteReason = function() {
    if(!deleteReasonInput) return;
    const reason = deleteReasonInput.value.trim();
    if (!reason) { alert("❌ 請輸入理由"); return; }
    tempDeleteReason = reason;
    closeDeleteModal();
    openPromiseModal();
};

const promiseModal = document.getElementById('promise-modal');
const promiseInput = document.getElementById('promise-input');
const promiseMsg = document.getElementById('promise-msg');

window.openPromiseModal = function() {
    if(promiseMsg) promiseMsg.innerHTML = `理由：「${tempDeleteReason}」<br>若屬實，輸入「絕不再犯」：`;
    if(promiseInput) promiseInput.value = '';
    if(promiseModal) {
        promiseModal.style.display = 'flex';
        setTimeout(() => promiseInput.focus(), 100);
    }
};

window.closePromiseModal = function() { if(promiseModal) promiseModal.style.display = 'none'; };

window.confirmPromise = function() {
    if(promiseInput && promiseInput.value === "絕不再犯") {
        closePromiseModal();
        openGameModal();
    } else {
        alert("看來妳還沒下定決心不要再犯");
    }
};

// --- 遊戲邏輯 ---
const gameModal = document.getElementById('game-modal');
const qLabel = document.getElementById('q-type-label');
const qContent = document.getElementById('q-content');
const gameInput = document.getElementById('game-answer');
const progressText = document.getElementById('q-progress');
const displayReasonEl = document.getElementById('display-reason');
const dots = document.querySelectorAll('.dot');

function shuffleString(str) {
    const arr = str.split('');
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    if (arr.join('') === str && arr.length > 1) {
        [arr[0], arr[1]] = [arr[1], arr[0]];
    }
    return arr.join('');
}

window.openGameModal = function() {
    gameStage = 0;
    if(displayReasonEl) displayReasonEl.textContent = `刪除理由：${tempDeleteReason}`;
    generateGameQueue();
    loadCurrentQuestion();
    updateDots();
    if(gameModal) {
        gameModal.style.display = 'flex';
        setTimeout(() => gameInput.focus(), 100);
    }
};

function generateGameQueue() {
    currentGameQueue = [];
    let tempPhrases = [...phrases];
    for(let i=0; i<5; i++) {
        const types = ['math_eq', 'math_op', 'text_scramble', 'text_scramble', 'logic_seq'];
        const type = types[Math.floor(Math.random() * types.length)];
        let qData = {};
        if (type === 'math_eq') {
            const x = Math.floor(Math.random()*9)+2, a = Math.floor(Math.random()*8)+2, b = Math.floor(Math.random()*19)+1;
            qData = { label: "求解 x", content: `${a}x + ${b} = ${(a*x)+b}`, answer: x.toString() };
        } else if (type === 'math_op') {
            const a = Math.floor(Math.random()*20)+1, b = Math.floor(Math.random()*8)+2, c = Math.floor(Math.random()*8)+2;
            qData = { label: "先乘除後加減", content: `${a} + ${b} × ${c} = ?`, answer: (a+b*c).toString() };
        } else if (type === 'text_scramble') {
            if (tempPhrases.length === 0) tempPhrases = [...phrases];
            const pIndex = Math.floor(Math.random() * tempPhrases.length);
            const phrase = tempPhrases[pIndex];
            tempPhrases.splice(pIndex, 1);
            qData = { label: "請重組正確句子", content: shuffleString(phrase), answer: phrase };
        } else if (type === 'logic_seq') {
            const s = Math.floor(Math.random()*3)+1;
            qData = { label: "下個數字？", content: `${s}, ${s+2}, ${s+4}, ?`, answer: (s+6).toString() };
        }
        currentGameQueue.push(qData);
    }
}

function loadCurrentQuestion() {
    const q = currentGameQueue[gameStage];
    if(qLabel) qLabel.textContent = q.label;
    if(qContent) qContent.textContent = q.content;
    if(gameInput) gameInput.value = '';
    if(progressText) progressText.textContent = `${gameStage + 1}/5`;
}

window.checkGameAnswer = function() {
    const currentQ = currentGameQueue[gameStage];
    if (gameInput.value.trim() === currentQ.answer) {
        gameStage++;
        updateDots();
        if (gameStage >= 5) {
            alert("🎉 驗證通過");
            expenses.splice(currentActionIndex, 1);
            updateUI();
            if(gameModal) gameModal.style.display = 'none';
        } else {
            loadCurrentQuestion();
        }
    } else {
        alert(`❌ 錯了！正確答案是：${currentQ.answer}\n\n看來你的大腦還不清醒，請重新來過！`);
        if(gameModal) gameModal.style.display = 'none';
    }
};

function updateDots() {
    dots.forEach((d, i) => d.className = i < gameStage ? 'dot active' : 'dot');
}