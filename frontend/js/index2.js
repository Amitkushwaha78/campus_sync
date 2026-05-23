document.addEventListener('DOMContentLoaded', () => {
            // Theme toggle
            const toggleButton = document.getElementById('theme-toggle');
            const body = document.body;

            if (toggleButton) {
                toggleButton.addEventListener('click', () => {
                    body.classList.toggle('dark-theme');
                    toggleButton.textContent = body.classList.contains('dark-theme')
                        ? 'Light'
                        : 'Dark';
                });
            }

            // feature toggle icon (stateful + persistent)
            const featureToggle = document.getElementById('featureToggle');
            const TOGGLE_KEY = 'club_feature_toggle_on';
            function setToggleState(on, persist = true) {
                if (!featureToggle) return;
                featureToggle.textContent = on ? 'toggle_on' : 'toggle_off';
                featureToggle.classList.toggle('on', on);
                featureToggle.classList.toggle('off', !on);
                featureToggle.setAttribute('aria-pressed', on ? 'true' : 'false');
                document.body.classList.toggle('feature-enabled', on);
                if (persist) localStorage.setItem(TOGGLE_KEY, on ? '1' : '0');
            }

            if (featureToggle) {
                // initialize from storage
                const saved = localStorage.getItem(TOGGLE_KEY);
                const isOn = saved === '1';
                setToggleState(isOn, false);

                featureToggle.addEventListener('click', () => {
                    const currentlyOn = featureToggle.classList.contains('on');
                    setToggleState(!currentlyOn, true);
                });
            }

            // Modal logic
            const modal = document.getElementById('loginModal');
            const modalContent = modal ? modal.querySelector('.modal-content') : null;
            const closeModal = document.getElementById('closeModal');
            const msg = document.getElementById('msg');

            // track selected club when a card is clicked and open modal
            let selectedClub = null;
            const clubMap = {
                hacker: { id: 'hacker', name: 'Hacking Club' },
                chess: { id: 'chess', name: 'Chess Club' },
                creative: { id: 'creative', name: 'Creative Club' },
                culture: { id: 'culture', name: 'Culture Club' },
                robotics: { id: 'robotics', name: 'Robotics Club' }
            };

            document.addEventListener('click', (e) => {
                const container = e.target.closest && e.target.closest('.container');
                if (container) {
                    // prefer data-club over id (data-club is set on both sliders)
                    const clubKey = container.dataset && container.dataset.club ? container.dataset.club : container.id;
                    const id = clubKey;
                    selectedClub = clubMap[id] || { id, name: id };
                    // show selected club in modal
                    const clubLabel = document.getElementById('selectedClubLabel');
                    if (clubLabel) clubLabel.textContent = selectedClub.name;
                    // show join button
                    const joinBtn = document.getElementById('joinClubBtn');
                    if (joinBtn) joinBtn.style.display = 'inline-block';
                    if (modal) modal.style.display = 'flex';
                    if (msg) msg.textContent = '';
                    return;
                }

                // close modal when clicking outside modal content (i.e., on the overlay)
                if (modal && e.target === modal) {
                    modal.style.display = 'none';
                    return;
                }
            });

            // close button
            if (closeModal) {
                closeModal.addEventListener('click', () => {
                    if (modal) modal.style.display = 'none';
                });
            }

            // close on Escape
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && modal && modal.style.display === 'flex') {
                    modal.style.display = 'none';
                }
            });

            const API_BASE = '';// same origin

            // Register
            const doRegisterBtn = document.getElementById('doRegister');
            if (doRegisterBtn) {
                doRegisterBtn.addEventListener('click', async () => {
                    const enrollment = document.getElementById('regEnrollment').value.trim();
                    const name = document.getElementById('regName').value.trim();
                    const branch = document.getElementById('regBranch').value.trim();
                    const email = document.getElementById('regEmail').value.trim();
                    const mobile = document.getElementById('regMobile').value.trim();
                    const password = document.getElementById('regPassword').value;

                    if (!enrollment || !name || !email || !mobile || !password) {
                        showMsg('Please fill all required registration fields', 'orange');
                        return;
                    }

                    try {
                        const payload = { enrollment, name, branch, email, mobile, password };
                        if (selectedClub) { payload.clubId = selectedClub.id; payload.clubName = selectedClub.name; }
                        const res = await fetch(API_BASE + '/api/register', {
                            method: 'POST', headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(payload)
                        });
                        const data = await res.json();
                        if (!res.ok) throw new Error(data.error || 'Registration failed');
                        showMsg(data.message || 'Registered. Enter OTP sent to mobile (server console).', 'green');
                        const otpForm = document.getElementById('otpForm');
                        if (otpForm) otpForm.style.display = 'block';
                        const otpEnrollment = document.getElementById('otpEnrollment');
                        if (otpEnrollment) otpEnrollment.value = enrollment;
                    } catch (err) {
                        showMsg(err.message || 'Error registering', 'red');
                    }
                });
            }

            // Verify OTP
            const verifyOtpBtn = document.getElementById('verifyOtpBtn');
            if (verifyOtpBtn) {
                verifyOtpBtn.addEventListener('click', async () => {
                    const enrollmentEl = document.getElementById('otpEnrollment');
                    const otpEl = document.getElementById('otpCode');
                    const enrollment = enrollmentEl ? enrollmentEl.value.trim() : '';
                    const otp = otpEl ? otpEl.value.trim() : '';
                    if (!enrollment || !otp) { showMsg('Provide enrollment and OTP', 'orange'); return; }
                    try {
                        const res = await fetch(API_BASE + '/api/verify-otp', {
                            method: 'POST', headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ enrollment, otp })
                        });
                        const data = await res.json();
                        if (!res.ok) throw new Error(data.error || 'OTP verification failed');
                        showMsg(data.message || 'Mobile verified', 'green');

                        // if server returns token and user, treat as logged in
                        if (data.token) {
                            localStorage.setItem('token', data.token);
                            showDashboard(data.user || null);
                            if (modal) modal.style.display = 'none';
                        }
                    } catch (err) {
                        showMsg(err.message || 'Error verifying OTP', 'red');
                    }
                });
            }

            // Login - common function used by top panel and modal fallback
            async function performLogin(enrollment, password) {
                if (!enrollment || !password) { showMsg('Enter credentials', 'orange'); return; }
                try {
                    // First attempt login to get token
                    const loginRes = await fetch(API_BASE + '/api/login', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ enrollment, password })
                    });
                    const loginData = await loginRes.json();
                    if (!loginRes.ok) throw new Error(loginData.error || 'Login failed');
                    
                    // Store token
                    const token = loginData.token;
                    localStorage.setItem('token', token);
                    
                    // Now fetch user data with token
                    const meRes = await fetch(API_BASE + '/api/me', {
                        headers: { 
                            'Authorization': 'Bearer ' + token,
                            'Content-Type': 'application/json'
                        }
                    });
                    const meData = await meRes.json();
                    if (!meRes.ok) throw new Error(meData.error || 'Could not fetch user data');
                    
                    showMsg('Login successful!', 'green');
                    // hide panels
                    const topPanel = document.getElementById('topLoginPanel'); if (topPanel) topPanel.classList.remove('visible');
                    const modalEl = document.getElementById('loginModal'); if (modalEl) modalEl.style.display = 'none';
                    
                    // Show dashboard with user data
                    showDashboard(meData.user);
                } catch (err) {
                    showMsg(err.message || 'Login error', 'red');
                    console.error('Login error:', err);
                }
            }

            // wire top-panel login
            const navLoginBtn = document.getElementById('navLoginBtn');
            const topLoginPanel = document.getElementById('topLoginPanel');
            const closeTopLogin = document.getElementById('closeTopLogin');
            if (navLoginBtn && topLoginPanel) {
                navLoginBtn.addEventListener('click', () => {
                    // Always use classList for toggling visibility
                    if (topLoginPanel.classList.contains('visible')) {
                        topLoginPanel.classList.remove('visible');
                    } else {
                        topLoginPanel.classList.add('visible');
                        // Focus the enrollment input for better UX
                        const enrollmentInput = document.getElementById('loginEnrollment_top');
                        if (enrollmentInput) enrollmentInput.focus();
                    }
                });
            }
            if (closeTopLogin && topLoginPanel) {
                closeTopLogin.addEventListener('click', () => {
                    topLoginPanel.classList.remove('visible');
                });
            }

            const doLoginTop = document.getElementById('doLogin_top');
            if (doLoginTop) {
                doLoginTop.addEventListener('click', () => {
                    const enrollment = document.getElementById('loginEnrollment_top').value.trim();
                    const password = document.getElementById('loginPassword_top').value;
                    performLogin(enrollment, password);
                });
            }

            // wire modal-login fallback buttons (kept for backward compatibility)
            const doLoginModal = document.getElementById('doLogin_modal');
            if (doLoginModal) {
                doLoginModal.addEventListener('click', () => {
                    const enrollment = document.getElementById('loginEnrollment_modal').value.trim();
                    const password = document.getElementById('loginPassword_modal').value;
                    performLogin(enrollment, password);
                });
            }

            // show dashboard and hide login forms
            const dashboard = document.getElementById('dashboard');
            const noticesContainerId = 'noticeList';
            function showDashboard(user) {
                // First update the user menu (avatar and dropdown)
                try { 
                    updateUserMenu(user); 
                    console.log('Updated user menu with:', user ? user.name : 'no user');
                } catch (e) { 
                    console.error('Error updating user menu:', e);
                }
                
                // hide login-related forms
                const registerForm = document.getElementById('registerForm');
                const loginForm = document.getElementById('loginForm');
                const otpForm = document.getElementById('otpForm');
                const navLoginBtn = document.getElementById('navLoginBtn');
                
                if (registerForm) registerForm.style.display = 'none';
                if (loginForm) loginForm.style.display = 'none';
                if (otpForm) otpForm.style.display = 'none';
                if (navLoginBtn) navLoginBtn.style.display = 'none';
                
                if (!dashboard) return;
                
                // fill user info: if not provided, fetch /api/me
                if (user) {
                    fillDashboard(user);
                    dashboard.style.display = 'block';
                    // show clubs and notices if provided
                    renderClubsAndNotices(user);
                    return;
                }
                const token = localStorage.getItem('token');
                if (!token) {
                    // If no token, show login button and hide dashboard
                    if (navLoginBtn) navLoginBtn.style.display = 'inline-block';
                    if (dashboard) dashboard.style.display = 'none';
                    return;
                }
                fetch(API_BASE + '/api/me', { headers: { Authorization: 'Bearer ' + token } })
                    .then(r => r.json())
                    .then(data => {
                        if (data && data.ok && data.user) {
                            fillDashboard(data.user);
                            dashboard.style.display = 'block';
                            renderClubsAndNotices(data.user, data.notices || []);
                            // update top-right user menu
                            updateUserMenu(data.user);
                        } else {
                            showMsg('Unable to load dashboard', 'red');
                        }
                    }).catch(err => showMsg('Unable to load dashboard', 'red'));
            }

            function fillDashboard(user) {
                document.getElementById('dashName').textContent = user.name || '';
                document.getElementById('dashEnrollment').textContent = user.enrollment || '';
                document.getElementById('dashBranch').textContent = user.branch || '';
                document.getElementById('dashEmail').textContent = user.email || '';
            }

            function renderClubsAndNotices(user, notices = []) {
                // club count
                const clubCountEl = document.getElementById('clubCount');
                const clubListEl = document.getElementById('clubList');
                if (clubCountEl) clubCountEl.textContent = (user.clubs || []).length;
                if (clubListEl) {
                    clubListEl.innerHTML = '';
                    (user.clubs || []).forEach(c => {
                        const el = document.createElement('div');
                        el.textContent = `${c.clubName} (joined ${new Date(c.joinedAt).toLocaleDateString()})`;
                        clubListEl.appendChild(el);
                    });
                }

                const noticeList = document.getElementById('noticeList');
                if (noticeList) {
                    noticeList.innerHTML = '';
                    (notices || []).forEach(n => {
                        const item = document.createElement('div');
                        item.style.borderTop = '1px solid #ccc';
                        item.style.padding = '8px 0';
                        item.innerHTML = `<strong>${n.title}</strong><div>${n.message || ''}</div><small>${new Date(n.createdAt).toLocaleString()}</small>`;
                        noticeList.appendChild(item);
                    });
                    if ((notices || []).length === 0) noticeList.textContent = 'No recent notices';
                }
            }

            // logout
            const logoutBtn = document.getElementById('logoutBtn');
            if (logoutBtn) {
                logoutBtn.addEventListener('click', () => {
                    localStorage.removeItem('token');
                    // reload to reset UI
                    location.reload();
                });
            }

            // Join club button
            const joinClubBtn = document.getElementById('joinClubBtn');
            if (joinClubBtn) {
                joinClubBtn.addEventListener('click', async () => {
                    if (!selectedClub) { showMsg('No club selected', 'orange'); return; }
                    const token = localStorage.getItem('token');
                    if (!token) { showMsg('Please register/login and verify mobile before joining a club', 'orange'); return; }
                    try {
                        const res = await fetch(API_BASE + '/api/join-club', {
                            method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
                            body: JSON.stringify({ clubId: selectedClub.id, clubName: selectedClub.name })
                        });
                        const data = await res.json();
                        if (!res.ok) throw new Error(data.error || 'Unable to join club');
                        showMsg('Joined club: ' + selectedClub.name, 'green');
                        // refresh dashboard
                        showDashboard(null);
                    } catch (err) {
                        showMsg(err.message || 'Error joining club', 'red');
                    }
                });
            }

            // Check login state and show appropriate UI on page load
            (async function checkInitialLoginState() {
                const token = localStorage.getItem('token');
                if (!token) {
                    // Not logged in - show login button, hide user area
                    updateUserMenu(null);
                    return;
                }
                
                try {
                    // Try to fetch user data with stored token
                    const res = await fetch(API_BASE + '/api/me', {
                        headers: { 
                            'Authorization': 'Bearer ' + token,
                            'Content-Type': 'application/json'
                        }
                    });
                    const data = await res.json();
                    
                    if (res.ok && data.user) {
                        // Valid token and user data - show dashboard
                        showDashboard(data.user);
                    } else {
                        // Invalid token - clear it and show login
                        localStorage.removeItem('token');
                        updateUserMenu(null);
                    }
                } catch (err) {
                    console.error('Error checking login state:', err);
                    localStorage.removeItem('token');
                    updateUserMenu(null);
                }
            })();

            function showMsg(text, color) {
                if (!msg) return;
                msg.textContent = text;
                msg.style.color = color || 'black';
            }

            // --------- User menu helpers & interactions ---------
            function updateUserMenu(user) {
                const userArea = document.getElementById('userArea');
                const navLogin = document.getElementById('navLoginBtn');
                const initialsEl = document.getElementById('userInitials');
                const initialsLarge = document.getElementById('userInitialsLarge');
                const nameEl = document.getElementById('userName');
                const emailEl = document.getElementById('userEmail');
                
                // Handle logout state
                if (!user) {
                    if (userArea) userArea.style.display = 'none';
                    if (navLogin) navLogin.style.display = 'inline-block';
                    return;
                }
                
                // Handle login state
                if (userArea) userArea.style.display = 'inline-block';
                if (navLogin) navLogin.style.display = 'none';
                
                // Update user info in dropdown
                const name = user.name || 'User';
                const email = user.email || '';
                if (nameEl) nameEl.textContent = name;
                if (emailEl) emailEl.textContent = email;
                
                // Calculate and set initials from full name
                let initials = 'U';
                if (name && name.trim()) {
                    const parts = name.trim().split(/\s+/);
                    if (parts.length >= 2) {
                        // Take first letter of first and last name
                        initials = (parts[0][0] + parts[parts.length-1][0]).toUpperCase();
                    } else {
                        // If single word, take up to first two letters
                        initials = name.slice(0, 2).toUpperCase();
                    }
                }
                
                // Update both avatar displays
                if (initialsEl) initialsEl.textContent = initials;
                if (initialsLarge) initialsLarge.textContent = initials;
                
                // Debug log to verify the update
                console.log('Updated user menu:', { name, email, initials });
            }

            // toggle dropdown and hook logout
            (function wireUserMenu() {
                const userAvatarBtn = document.getElementById('userAvatarBtn');
                const userDropdown = document.getElementById('userDropdown');
                const userLogoutBtn = document.getElementById('userLogoutBtn');
                if (!userAvatarBtn || !userDropdown) return;

                userAvatarBtn.addEventListener('click', (ev) => {
                    ev.stopPropagation();
                    const open = userDropdown.classList.toggle('open');
                    userAvatarBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
                    userDropdown.setAttribute('aria-hidden', open ? 'false' : 'true');
                });

                // close when clicking outside
                document.addEventListener('click', (e) => {
                    if (!userDropdown.contains(e.target) && !userAvatarBtn.contains(e.target)) {
                        userDropdown.classList.remove('open');
                        userAvatarBtn.setAttribute('aria-expanded', 'false');
                        userDropdown.setAttribute('aria-hidden', 'true');
                    }
                });

                // close on Escape
                document.addEventListener('keydown', (e) => {
                    if (e.key === 'Escape') {
                        userDropdown.classList.remove('open');
                    }
                });

                if (userLogoutBtn) {
                    userLogoutBtn.addEventListener('click', () => {
                        localStorage.removeItem('token');
                        // ensure UI resets
                        updateUserMenu(null);
                        // reload page to clear any server-fetched state
                        location.reload();
                    });
                }
            })();

            // Profile button: scroll to dashboard when clicked
                (function wireProfileButton() {
                    const profileBtn = document.getElementById('userProfileBtn');
                    if (!profileBtn) return;
                    profileBtn.addEventListener('click', (e) => {
                        e.preventDefault();
                        const dashboardEl = document.getElementById('dashboard');
                        if (!dashboardEl) return;
                        // ensure dashboard is visible
                        if (dashboardEl.style.display === 'none') dashboardEl.style.display = 'block';
                        // make focusable then focus
                        if (!dashboardEl.hasAttribute('tabindex')) dashboardEl.setAttribute('tabindex', '-1');
                        dashboardEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        // wait a bit for scroll then focus for accessibility
                        setTimeout(() => { try { dashboardEl.focus(); } catch (e) {} }, 600);
                    });
                })();

                        // Manual Scroll
                        function scrollSlider(id, direction) {
                            const slider = document.getElementById(id);
                            if (!slider) return;
                            const scrollAmount = 300;
                            slider.scrollBy({
                                left: direction * scrollAmount,
                                behavior: "smooth"
                            });
                        }

               
                        
document.querySelectorAll(".slider-container").forEach((container) => {
    let slider = container.querySelector(".slider");
    let slides = container.querySelectorAll("img");
    let dotsContainer = container.querySelector(".dots");

    let index = 0;

    // create dots
    slides.forEach((_, i) => {
        let dot = document.createElement("span");
        dot.onclick = () => goTo(i);
        dotsContainer.appendChild(dot);
    });

    let dots = dotsContainer.querySelectorAll("span");

    function update() {
        slider.style.transform = `translateX(-${index * 100}%)`;
        dots.forEach(d => d.classList.remove("active"));
        dots[index].classList.add("active");
    }

    function next() {
        index = (index + 1) % slides.length;
        update();
    }

    function prev() {
        index = (index - 1 + slides.length) % slides.length;
        update();
    }

    function goTo(i) {
        index = i;
        update();
    }

    update();

    // autoplay
    setInterval(next, 3000);

    // swipe support
    let startX = 0;
    slider.addEventListener("touchstart", (e) => {
        startX = e.touches[0].clientX;
    });
    slider.addEventListener("touchend", (e) => {
        let endX = e.changedTouches[0].clientX;
        if (startX - endX > 50) next();
        if (endX - startX > 50) prev();
    });
});






 // --- Infinite Carousel Animation (no duplicates) ---
const carousel = document.getElementById("club-carousel");

let scrollSpeed = 50; // pixels per second
let paused = false;

carousel.addEventListener("mouseenter", () => paused = true);
carousel.addEventListener("mouseleave", () => paused = false);

let last = performance.now();
const pxPerMs = scrollSpeed / 1000;

function loop(now) {
    const dt = now - last;
    last = now;

    if (!paused) {
        carousel.scrollLeft += pxPerMs * dt;

        // When we reach the end, instantly reset to start (seamless)
        if (carousel.scrollLeft >= carousel.scrollWidth - carousel.clientWidth) {
            carousel.scrollLeft = 0;
        }
    }

    requestAnimationFrame(loop);
}

requestAnimationFrame(loop);

        });