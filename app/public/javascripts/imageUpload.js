$(document).ready(function(){
    $('#imageUpload').on('change', function(evt){
        var files = evt.target.files; // FileList object

        var totalNumFiles = $('#imageUpload').get(0).files.length;

        if(totalNumFiles > 5){
            alert("Sorry! There is a maximum limit of 5 images per product");
            return false;
        }

        globalIndex = 0;
        $("#list").empty();

        if(globalIndex <= 0){
            //only on first run
            $("#list").append('<br><span>Please select one image to be the thumbnail</span><br>');
        }

        // Loop through the FileList and render image files as thumbnails.
        for (var i = 0, f; f = files[i]; i++) {

        // Only process image files.
        if (!f.type.match('image.*')) {
            continue;
        }

        var reader = new FileReader();

        // Closure to capture the file information.
        reader.onload = (function(theFile) {
            return function(e) {
              $("#list").append('<img id="' + (globalIndex++) + '" class="thumb" src="' + e.target.result + '"/>');
            };
        })(f);
          // Read in the image file as a data URL.
          reader.readAsDataURL(f);
        }
    });

    $('#list').on('click', 'img.thumb', function (e) {
        $('.thumb').css("border", "1px solid #CCCCCC");
        $(this).css("border", "4px solid #3f3f3f");
        $('#thumbnailIndex').val($(this).attr('id'));
    });

    $('#list').on('mouseenter', 'img.thumb', function (e) {
        $(this).css("opacity", "0.5");
    });

    $('#list').on('mouseleave', 'img.thumb', function (e) {
        $(this).css("opacity", "1.0");
    });
});
