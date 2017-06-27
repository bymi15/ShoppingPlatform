$(document).ready(function(){
    if($('#message').length > 0){
        $('#message').fadeIn("slow", function () {
            $(this).delay(5000).fadeOut("slow");
        });
    }
});
