document.addEventListener('alpine:init', () => {
  Alpine.store('app', {
    currentPage: 'dashboard',
    sidebarOpen: false,
    navigate(page) {
      this.currentPage = page;
      this.sidebarOpen = false;
      window.location.hash = `#/${page}`;
    }
  });
});
