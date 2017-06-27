$(document).ready(function(){
    var currentCategoryId = $('#catId').val();

    if(currentCategoryId){
        $('.categoryListing').removeClass('active');
        $('#cat_' + currentCategoryId).addClass('active');
    }else{
        $('.categoryListing').removeClass('active');
        $('#cat_all').addClass('active');
    }
});
