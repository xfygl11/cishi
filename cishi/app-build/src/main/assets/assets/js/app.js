(function(){
  function init(){
    var savedUrl = localStorage.getItem('movie_config_url') || 'http://www.饭太硬.net/tv';
    var input = document.getElementById('tvConfigUrl');
    if(input) input.value = savedUrl;

    var loadBtn = document.getElementById('loadConfigBtn');
    if(loadBtn){
      loadBtn.onclick = function(){
        var url = input ? input.value.trim() : savedUrl;
        if(!url){ alert('请输入配置源地址'); return; }
        if(window.loadMovieConfig){ loadMovieConfig(); }
      };
    }

    var saveBtn = document.getElementById('saveConfigBtn');
    if(saveBtn){
      saveBtn.onclick = function(){
        if(window.saveMovieConfig){ saveMovieConfig(); }
      };
    }

    if(window.loadMovieConfig){
      setTimeout(function(){ loadMovieConfig(); }, 300);
    }
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
