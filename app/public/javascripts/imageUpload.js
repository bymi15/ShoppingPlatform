$('#imageUpload').on('change', function(e){
    var file = e.target.files[0];
    $('#imageName').val(file.name);
});
