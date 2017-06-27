var currentCategory = $("#currentCategory");

$(".catDropdownButtons").click(function(e){
    e.preventDefault();
    var newCategory = $(this).text();
    currentCategory.text(newCategory);
});

$("#searchButton").click(function(){
    var currentCategoryText = currentCategory.text();

    if(currentCategoryText.valueOf() === "All Categories"){
        return true;
    }else{
        $('<input />').attr('type', 'hidden').attr('name', 'cat').attr('value', currentCategoryText).appendTo('#searchForm');
    }
});
