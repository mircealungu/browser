$(function() {
    $("#account_creation_link").href=API_URL+"create_account";

    $('input').focus(function() {
        $(this).popover('show');
    });


    $('input').blur(function() {
        $(this).popover('hide');
    });

    $("form").validate({
        rules: {
            email: {
                required: true,
                email: true
            },
            password: {
                required:true,
                minlength: 4
            }
        },

        errorClass: "help-inline",
        errorElement: "span",
        highlight: function(element, errorClass, validClass) {
            $(element).parents('.control-group').removeClass('success');
            $(element).parents('.control-group').addClass('error');
        },
        unhighlight: function(element, errorClass, validClass) {
            $(element).parents('.control-group').removeClass('error');
            $(element).parents('.control-group').addClass('success');
        }
    });

    $("#login-btn").click(function() {
        $("#login-error, #register-error").hide();
        if ($("form").valid()) {
            login($("#email").val(), $("#password").val(), function(result) {
                if(!result) {
                    $("#login-error").show();
                } else {
                    if (window.location.search)
                        window.location = "ext_dict_frame.html" + window.location.search;
                    else
                        window.location = "toolbar-popup.html";
                    browser.sendMessage("update_state", {
                        email: $("#email").val()
                    });
                }
            });
        }
        return false;
    });

    $("#register-btn").click(function() {
        $("#login-error, #register-error").hide();
        if ($("form").valid()) {
            register($("#email").val(), $("#password").val(), function(result) {
                if(!result) {
                    $("#register-error").show();
                } else {
                    window.location = "ext_dict_frame.html" + window.location.search;
                }
            });
        }
        return false;
    });
});
